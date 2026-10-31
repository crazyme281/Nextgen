import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { streamAIBackend, fetchSuggestions, type OutboundMessage, type ContentBlock } from "../lib/aiBackend";
import type { Attachment } from "../lib/attachments";
import type { Tables } from "@/types/database.types";

type Row = Tables<"ai_messages">;

/**
 * A message as the UI sees it. `attachments` comes from the jsonb column of
 * the same name; `pending` marks a locally-rendered row that hasn't been
 * confirmed by the database yet, and `streaming` marks the assistant row
 * currently being filled in token by token.
 */
export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  attachments: Attachment[];
  pending?: boolean;
  streaming?: boolean;
  failed?: boolean;
  /** Follow-up chips shown under this message once it's finished
   * streaming — undefined while unfetched/loading, [] if none came back. */
  suggestions?: string[];
}

function toChatMessage(row: Row & { attachments?: unknown }): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    created_at: row.created_at,
    attachments: Array.isArray(row.attachments) ? (row.attachments as unknown as Attachment[]) : [],
  };
}

/** Build the multimodal payload the backend expects. */
function toOutbound(messages: ChatMessage[]): OutboundMessage[] {
  return messages.map((m) => {
    const blocks: ContentBlock[] = [];
    for (const att of m.attachments) {
      // Prefer the stored URL; fall back to the inline data URL when the
      // storage bucket isn't set up yet.
      const url = att.url || att.dataUrl;
      if (url) blocks.push({ type: "image_url", image_url: { url } });
    }
    if (m.content.trim()) blocks.push({ type: "text", text: m.content });
    // Never send an empty block list — some providers reject it outright.
    if (blocks.length === 0) blocks.push({ type: "text", text: "" });
    return { role: m.role, content: blocks };
  });
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // True from the moment a send starts until it finishes. The history load below must never overwrite
  // the on-screen messages while this is set — see refresh().
  const sendingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const { data, error: dbError } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    // Root cause of "the first message vanishes": opening a brand-new chat starts this load AND sends
    // the first message at the same moment. The load finishes second, finds nothing saved yet, and
    // replaced the just-added question + reply placeholder with an empty list — so the chat looked
    // like nothing had been sent. If a send is in flight, the screen already has the newest state.
    if (!dbError && data && !sendingRef.current) setMessages(data.map(toChatMessage));
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    refresh();
    // Cancel any in-flight generation when switching chats.
    return () => abortRef.current?.abort();
  }, [refresh]);

  /** Let the user kill a long generation instead of waiting it out. */
  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    setSending(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false, pending: false } : m)),
    );
  }, []);

  async function sendMessage(content: string, attachments: Attachment[] = []) {
    if (!conversationId) return;
    if (!content.trim() && attachments.length === 0) return;
    if (sendingRef.current) return; // one reply at a time; the composer is disabled while sending anyway

    sendingRef.current = true;
    setSending(true);
    setError(null);

    const localId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    // Render the user's message immediately — waiting on the insert round
    // trip is what made the old flow feel unresponsive.
    const optimistic: ChatMessage = {
      id: localId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
      attachments,
      pending: true,
    };
    const history = [...messages, optimistic];
    setMessages([...history, {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      attachments: [],
      streaming: true,
    }]);

    // Strip the transient data URLs before persisting — they'd bloat the row
    // and the storage URL is the durable reference.
    const storedAttachments = attachments.map(({ dataUrl: _drop, ...rest }) => rest);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: userMsg, error: userInsertError } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: conversationId,
          role: "user",
          content,
          attachments: storedAttachments,
        } as never)
        .select()
        .single();

      // Couldn't save the question (offline / permissions): there is nothing to answer reliably, so say so
      // instead of streaming a reply into a chat that was never stored.
      if (userInsertError && !userMsg) throw new Error("Failed to fetch");

      if (userMsg) {
        const saved = toChatMessage(userMsg as Row);
        setMessages((prev) =>
          prev.map((m) => (m.id === localId ? { ...saved, attachments } : m)),
        );
      }

      // First user message in a fresh chat becomes its title, so the sidebar
      // doesn't just show "New Chat" forever.
      if (messages.length === 0) {
        const basis = content.trim() || "Image";
        const title = basis.length > 48 ? `${basis.slice(0, 48)}…` : basis;
        await supabase.from("ai_conversations").update({ title }).eq("id", conversationId);
      }

      let streamed = "";
      const result = await streamAIBackend(
        toOutbound(history),
        conversationId,
        (delta) => {
          streamed += delta;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: streamed } : m)),
          );
        },
        controller.signal,
      );

      const { data: aiMsg } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: result.reply,
        })
        .select()
        .single();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? aiMsg
              ? toChatMessage(aiMsg as Row)
              : { ...m, content: result.reply, streaming: false }
            : m,
        ),
      );

      // Best-effort — resolves after the fact, never blocks the reply
      // itself from finishing or being marked done.
      fetchSuggestions(content, result.reply).then((suggestions) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, suggestions } : m)),
        );
      });
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof Error && /Failed to fetch|NetworkError|Load failed|abort/i.test(e.message)
          ? "Couldn't reach Zorah. Check your internet connection and try again."
          : "Something went wrong generating that reply. Please try again.",
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false, failed: true } : m,
        ),
      );
    } finally {
      abortRef.current = null;
      sendingRef.current = false;
      setSending(false);
    }
  }

  return { messages, loading, sending, error, setError, sendMessage, stopGenerating, refresh };
}