import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
  IonFooter, IonTextarea, IonButton, IonIcon, IonSpinner, IonToast,
  IonActionSheet, IonSearchbar, IonAlert,
} from '@ionic/react';
import {
  send, checkmark, checkmarkDone, imageOutline, documentOutline,
  videocamOutline, callOutline, searchOutline, ellipsisVerticalOutline, micOutline,
  star, starOutline, chevronUp, chevronDown, close,
  personCircleOutline, imagesOutline, notificationsOffOutline, colorPaletteOutline,
  arrowUndoOutline, copyOutline, trashOutline, stopCircle, downloadOutline, timeOutline,
} from 'ionicons/icons';
import { useParams, useLocation, useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { useTypingIndicator, useIsOnline } from '@/lib/presence';
import { downloadChatImage } from '@/lib/mediaDownload';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import { acceptGameInvitation, declineGameInvitation } from '@/lib/gameInvitations';
import {
  getMessages, getMessagesByIds, getMeta, setMeta, putMessages, reconcileWindow, toLocalMessage, localEvents, deleteMessages,
} from '@/lib/localDb';
import { sendTextMessage } from '@/lib/messageSync';
import { tr } from '@/i18n';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null; // already plaintext — decrypted server-side by the messages_plain view
  media_url: string | null;
  media_type: 'image' | 'video' | 'audio' | 'document' | null;
  created_at: string;
  // Rows written before the server-side decryption trigger existed (or
  // sent by client code from before this migration) can never be
  // recovered — nextgen_msg_decrypt returns null for them. is_encrypted
  // stays true on those rows even though body comes back null, which is
  // how we tell "this had text that's now unrecoverable" apart from
  // "this was just a media message with no caption".
  is_encrypted: boolean;
  reply_to_id: string | null;
  game_invitation_id: string | null;
  /** Saved on this device but not yet accepted by the server (sent while offline). */
  local_status?: 'pending' | 'failed';
}

/** Header info cached on the device so a chat opens fully with no connection. */
interface RoomMeta {
  isGroup: boolean;
  groupTitle: string | null;
  memberCount: number;
  participantNames: Record<string, string>;
  peer: PeerInfo | null;
}

interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

interface Receipt {
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
}

interface PeerInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
  trust_level: any;
}

const MEDIA_BUCKET = 'chat-media';

/** Renders the WhatsApp-style tick: single (sent), double (delivered), blue double (read). */
const MessageTicks: React.FC<{ receipts: Receipt[] }> = ({ receipts }) => {
  if (receipts.length === 0) {
    return <IonIcon icon={checkmark} style={{ fontSize: 14, opacity: 0.7 }} />;
  }
  const allRead = receipts.every((r) => r.read_at);
  const allDelivered = receipts.every((r) => r.delivered_at);
  if (allRead) {
    return <IonIcon icon={checkmarkDone} style={{ fontSize: 14, color: '#34B7F1' }} />;
  }
  if (allDelivered) {
    return <IonIcon icon={checkmarkDone} style={{ fontSize: 14, opacity: 0.7 }} />;
  }
  return <IonIcon icon={checkmark} style={{ fontSize: 14, opacity: 0.7 }} />;
};

const MediaBubble: React.FC<{ message: Message; onDownload: (url: string, id: string) => void }> = ({ message, onDownload }) => {
  if (!message.media_url) return null;
  switch (message.media_type) {
    case 'image':
      return (
        <div style={{ position: 'relative', marginBottom: message.body ? 6 : 0 }}>
          <img
            src={message.media_url}
            alt=""
            style={{ maxWidth: '100%', borderRadius: 12, display: 'block' }}
          />
          <button
            type="button"
            aria-label={tr('Save image')}
            onClick={(e) => {
              e.stopPropagation();
              onDownload(message.media_url!, message.id);
            }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <IonIcon icon={downloadOutline} style={{ fontSize: 16 }} />
          </button>
        </div>
      );
    case 'video':
      return (
        <video
          src={message.media_url}
          controls
          style={{ maxWidth: '100%', borderRadius: 12, display: 'block', marginBottom: message.body ? 6 : 0 }}
        />
      );
    case 'audio':
      return (
        <audio src={message.media_url} controls style={{ display: 'block', marginBottom: message.body ? 6 : 0 }} />
      );
    case 'document':
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'inherit', marginBottom: message.body ? 6 : 0 }}
        >
          <IonIcon icon={documentOutline} /> {tr('Attachment')}
        </a>
      );
    default:
      return null;
  }
};

/** Centered pill divider between messages on different days — "Today" / "Yesterday" / date. */
const DateDivider: React.FC<{ iso: string }> = ({ iso }) => {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const label = isToday ? 'Today' : isYesterday ? 'Yesterday' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
      <span style={{
        background: 'var(--ion-item-background)', color: 'var(--ion-color-medium)',
        fontSize: 12, padding: '4px 12px', borderRadius: 999,
      }}>
        {label}
      </span>
    </div>
  );
};

const ChatRoom: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const location = useLocation<{ highlightMessageId?: string } | undefined>();
  const history = useHistory();
  const { user } = useAuth();
  const { startCall } = useCall();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [receiptsByMessage, setReceiptsByMessage] = useState<Record<string, Receipt[]>>({});
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, Reaction[]>>({});
  interface InviteInfo {
    status: string;
    game_id: string;
    match_id: string | null;
    sender_id: string;
    recipient_id: string | null;
  }
  interface GameInfo { key: string; name: string; icon: string | null }
  const [invitesById, setInvitesById] = useState<Record<string, InviteInfo>>({});
  const [gamesById, setGamesById] = useState<Record<string, GameInfo>>({});
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [peer, setPeer] = useState<PeerInfo | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  // The message currently held down — drives the floating reaction bar +
  // action menu. anchorRect is the pressed bubble's on-screen position, so
  // the picker renders right above/below it instead of at a fixed spot.
  const [pressedMessage, setPressedMessage] = useState<Message | null>(null);
  const [confirmDeleteForEveryone, setConfirmDeleteForEveryone] = useState<Message | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartPos = useRef<{ x: number; y: number } | null>(null);
  // message_reactions has no conversation_id column to filter a realtime
  // subscription on directly, so we keep this ref in sync with the
  // currently-loaded message ids and use it to ignore reaction events for
  // messages outside this conversation.
  const messageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);
  // Same reasoning as messageIdsRef just above — the realtime callback
  // below is set up once and would otherwise only ever see the
  // invitation ids that existed at that exact moment.
  const invitationIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    invitationIdsRef.current = new Set(
      messages.map((m) => m.game_invitation_id).filter((id): id is string => !!id),
    );
  }, [messages]);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingCancelledRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const highlightMessageId = location.state?.highlightMessageId;

  const { typingUserIds, notifyTyping } = useTypingIndicator(conversationId, user?.id);
  const peerOnline = useIsOnline(peer?.id ?? null, user?.id);

  const loadReceipts = async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const { data } = await supabase
      .from('message_receipts')
      .select('*')
      .in('message_id', messageIds);
    if (!data) return;
    const grouped: Record<string, Receipt[]> = {};
    (data as unknown as Receipt[]).forEach((r) => {
      grouped[r.message_id] = grouped[r.message_id] ? [...grouped[r.message_id], r] : [r];
    });
    setReceiptsByMessage((prev) => ({ ...prev, ...grouped }));
  };

  const loadReactions = async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const { data } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messageIds);
    if (!data) return;
    const grouped: Record<string, Reaction[]> = {};
    (data as unknown as Reaction[]).forEach((r) => {
      grouped[r.message_id] = grouped[r.message_id] ? [...grouped[r.message_id], r] : [r];
    });
    setReactionsByMessage((prev) => ({ ...prev, ...grouped }));
  };

  // Loads (or refreshes) the invitation + game details for any message
  // in the thread that has a game_invitation_id, so the chat bubble can
  // render "invited to play Chess" instead of just linking an id.
  const loadInvitations = async (invitationIds: string[]) => {
    if (invitationIds.length === 0) return;
    const { data } = await supabase
      .from('game_invitations')
      .select('id, status, game_id, match_id, sender_id, recipient_id')
      .in('id', invitationIds);
    if (!data) return;
    setInvitesById((prev) => {
      const next = { ...prev };
      data.forEach((row: any) => { next[row.id] = row; });
      return next;
    });
    const gameIds = Array.from(new Set(data.map((r: any) => r.game_id)));
    const missingGameIds = gameIds.filter((id) => !gamesById[id]);
    if (missingGameIds.length > 0) {
      const { data: gameRows } = await supabase.from('games').select('id, key, name, icon').in('id', missingGameIds);
      if (gameRows) {
        setGamesById((prev) => {
          const next = { ...prev };
          gameRows.forEach((g: any) => { next[g.id] = { key: g.key, name: g.name, icon: g.icon }; });
          return next;
        });
      }
    }
  };

  const loadPeer = async () => {
    if (!user) return;
    const { data: convo, error: convoErr } = await supabase
      .from('conversations')
      .select('kind, title')
      .eq('id', conversationId)
      .maybeSingle();
    // Offline (or otherwise unreachable): keep the header loaded from the on-device cache.
    if (convoErr || !convo) return;
    const isGroupConvo = convo?.kind === 'group';
    setIsGroup(isGroupConvo);

    if (isGroupConvo) {
      setGroupTitle(convo?.title ?? 'Group');
      // Needed for two things: showing the group name/member count in the
      // header, and resolving "<name> is typing…" / reply-quote sender
      // labels — none of which conversation_summaries covers, since that
      // view is direct-chat only.
      const { data: members } = await supabase
        .from('conversation_participants')
        .select('user_id, profiles(full_name)')
        .eq('conversation_id', conversationId);
      if (members) {
        const rows = members as unknown as { user_id: string; profiles: { full_name: string | null } | null }[];
        const map: Record<string, string> = {};
        rows.forEach((r) => { map[r.user_id] = r.profiles?.full_name ?? 'Someone'; });
        setParticipantNames(map);
        setMemberCount(rows.length);
        setMeta(user.id, `room:${conversationId}`, {
          isGroup: true, groupTitle: convo?.title ?? 'Group', memberCount: rows.length, participantNames: map, peer: null,
        } as RoomMeta);
      }
      return;
    }

    // conversation_summaries carries the "other" direct participant's profile info.
    const { data } = await supabase
      .from('conversation_summaries')
      .select('other_user_id, other_full_name, other_avatar_url, other_trust_level')
      .eq('conversation_id', conversationId)
      .eq('viewer_id', user.id)
      .maybeSingle();
    if (data) {
      const peerInfo: PeerInfo = {
        id: (data as any).other_user_id,
        full_name: (data as any).other_full_name,
        avatar_url: (data as any).other_avatar_url,
        trust_level: (data as any).other_trust_level,
      };
      setPeer(peerInfo);
      setMeta(user.id, `room:${conversationId}`, {
        isGroup: false, groupTitle: null, memberCount: 0, participantNames: {}, peer: peerInfo,
      } as RoomMeta);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      // 1) Show what's saved on the device immediately — this is what makes the
      //    chat readable with no internet — then let the network update it.
      if (user) {
        const [local, room] = await Promise.all([
          getMessages(user.id, conversationId!),
          getMeta<RoomMeta>(user.id, `room:${conversationId}`),
        ]);
        if (active && room) {
          setIsGroup(room.isGroup);
          setGroupTitle(room.groupTitle);
          setMemberCount(room.memberCount);
          setParticipantNames(room.participantNames);
          setPeer(room.peer);
        }
        if (active && local.length > 0) {
          setMessages(local as Message[]);
          setTimeout(() => contentRef.current?.scrollToBottom(0), 50);
        }
      }
      // 2) messages_plain decrypts server-side and still enforces the same
      // RLS as the base `messages` table (security_invoker), so this is
      // just as access-controlled as querying `messages` directly.
      const { data } = await supabase
        .from('messages_plain')
        .select('*')
        .eq('conversation_id', conversationId)
        // Newest 200 (then put back in reading order). Ascending + limit returned the OLDEST 200, so in
        // a long chat new messages never appeared — and the local reconcile below would have dropped them.
        .order('created_at', { ascending: false })
        .limit(200);
      let rows = ((data ?? []) as unknown as Message[]).slice().reverse();
      let hiddenIds = new Set<string>();
      if (user) {
        const { data: hidden } = await supabase
          .from('message_deletions')
          .select('message_id')
          .eq('user_id', user.id);
        hiddenIds = new Set((hidden ?? []).map((h: { message_id: string }) => h.message_id));
        rows = rows.filter((m) => !hiddenIds.has(m.id));
      }
      if (active && data) {
        if (user) {
          // Merge the server's answer INTO the on-device copy, then show the on-device copy. Showing the
          // server list directly meant any empty/partial answer (a token refreshing, a hiccup) replaced
          // the screen with nothing — messages "vanished" when a chat was reopened even though they were
          // safely stored. The device copy only ever grows from the server, or shrinks on a real deletion.
          await putMessages(user.id, rows.map(toLocalMessage));
          if (hiddenIds.size > 0) await deleteMessages(user.id, [...hiddenIds]);
          if (rows.length > 0) {
            await reconcileWindow(user.id, conversationId!, rows[0].created_at, new Set(rows.map((m) => m.id)));
          }
          const merged = (await getMessages(user.id, conversationId!)) as Message[];
          setMessages(merged);
          rows = merged;
        } else {
          setMessages(rows);
        }
        const allIds = rows.map((m) => m.id);
        await loadReceipts(rows.filter((m) => m.sender_id === user?.id).map((m) => m.id));
        await loadReactions(allIds);
        await loadInvitations(rows.map((m) => m.game_invitation_id).filter((id): id is string => !!id));
      }
      await loadPeer();
      if (user) {
        const { data: starred } = await supabase
          .from('starred_messages')
          .select('message_id')
          .eq('user_id', user.id);
        if (active && starred) {
          setStarredIds(new Set((starred as { message_id: string }[]).map((s) => s.message_id)));
        }
      }
      // mark conversation as read for this viewer (also stamps read_at on receipts)
      await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
      if (highlightMessageId) {
        setTimeout(() => {
          document.getElementById(`message-${highlightMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250);
      } else {
        setTimeout(() => contentRef.current?.scrollToBottom(0), 50);
      }
    })();

    const messageChannel = supabase
      .channel(`room-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          // Realtime postgres_changes always reflects the underlying
          // table, so payload.new.body here is still ciphertext (the
          // encryption key only exists inside the DB function, not on
          // the client). Re-fetch this one row through messages_plain to
          // get the decrypted version instead of trying to decrypt it here.
          const insertedId = (payload.new as { id: string }).id;
          const { data: plain } = await supabase
            .from('messages_plain')
            .select('*')
            .eq('id', insertedId)
            .maybeSingle();
          if (!plain) return; // RLS filtered it out, or it's already gone
          const msg = plain as unknown as Message;
          // Already on screen (our own message coming back): just confirm it; otherwise add it.
          setMessages((prev) => (prev.some((m) => m.id === msg.id)
            ? prev.map((m) => (m.id === msg.id ? { ...m, created_at: msg.created_at, local_status: undefined } : m))
            : [...prev, msg]));
          setTimeout(() => contentRef.current?.scrollToBottom(200), 50);
          if (msg.game_invitation_id) await loadInvitations([msg.game_invitation_id]);
          if (msg.sender_id !== user?.id) {
            await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
          }
        }
      )
      .on(
        // No filter available here — game_invitations has no
        // conversation_id of its own to filter on — so this just checks
        // client-side whether the changed row is one this thread is
        // actually showing. Low volume table, harmless to receive all of
        // it. This is what makes Accept/Decline update live on BOTH
        // sides' chat, not only the one who tapped the button.
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_invitations' },
        (payload) => {
          const row = payload.new as InviteInfo & { id: string };
          if (!invitationIdsRef.current.has(row.id)) return;
          setInvitesById((prev) => ({ ...prev, [row.id]: row }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_receipts' },
        (payload) => {
          const r = payload.new as Receipt;
          setReceiptsByMessage((prev) => {
            const existing = prev[r.message_id] ?? [];
            const next = existing.filter((x) => x.user_id !== r.user_id).concat(r);
            return { ...prev, [r.message_id]: next };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const row = (payload.new ?? payload.old) as Reaction | undefined;
          if (!row || !messageIdsRef.current.has(row.message_id)) return;
          setReactionsByMessage((prev) => {
            const existing = (prev[row.message_id] ?? []).filter((x) => x.user_id !== row.user_id);
            const next = payload.eventType === 'DELETE' ? existing : [...existing, row];
            return { ...prev, [row.message_id]: next };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_deletions', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          const hiddenId = (payload.new as { message_id: string }).message_id;
          setMessages((prev) => prev.filter((m) => m.id !== hiddenId));
        }
      )
      .subscribe();

    // Changes made to the on-device database elsewhere (background sync after reconnecting,
    // the global message listener, an offline message finally being sent) show up here live.
    const offLocal = localEvents.on(async (ev) => {
      if (!user || !active) return;
      if (ev.type === 'upsert' && ev.conversationId === conversationId) {
        const changed = (await getMessagesByIds(user.id, ev.ids)) as Message[];
        if (!active || changed.length === 0) return;
        setMessages((prev) => {
          const byId = new Map<string, Message>((prev as Message[]).map((m) => [m.id, m] as [string, Message]));
          changed.forEach((m) => byId.set(m.id, m));
          return [...byId.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        setTimeout(() => contentRef.current?.scrollToBottom(200), 50);
      } else if (ev.type === 'delete') {
        setMessages((prev) => prev.filter((m) => !ev.ids.includes(m.id)));
      }
    });

    return () => {
      active = false;
      offLocal();
      supabase.removeChannel(messageChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Set synchronously the instant a send starts. `draft` is React state and still holds the old text until
  // the next render, so a fast double-tap / double-Enter used to read the same text twice and send it twice.
  const sendLockRef = useRef(false);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !user || sendLockRef.current) return;
    sendLockRef.current = true;
    // Released on the next tick, after the cleared draft has rendered, so a genuine second message still works.
    setTimeout(() => { sendLockRef.current = false; }, 400);
    setDraft('');
    const replyingTo = replyTarget?.id ?? null;
    setReplyTarget(null);

    // Shown the instant Send is tapped — don't wait on the DB round trip,
    // or worse, on the realtime INSERT event echoing it back, before the
    // sender sees their own message. That round trip is what made sending
    // feel like it "waited" until leaving and re-opening the chat: this
    // screen's realtime channel is only set up once per conversation (see
    // the effect above), so if that subscription hadn't finished
    // authorizing yet at the moment of the very first send, the INSERT
    // event for it would silently never arrive on THIS visit — only a
    // fresh mount (leaving and coming back) would pick it up, via the
    // plain SELECT on open. Showing our own message locally sidesteps
    // that dependency entirely, the same pattern every real chat app uses.
    const optimisticId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: conversationId!,
      sender_id: user.id,
      body,
      media_url: null,
      media_type: null,
      created_at: createdAt,
      is_encrypted: true,
      reply_to_id: replyingTo,
      game_invitation_id: null,
      local_status: 'pending',
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => contentRef.current?.scrollToBottom(200), 50);

    // The message is written to the on-device database first (so it survives the app being
    // closed), then sent. The id generated here IS the database primary key, so there is no
    // temporary-id swap and a retry can never create a duplicate. If there is no connection
    // the message stays queued (clock icon) and goes out automatically after reconnecting.
    // Plain text goes in; the BEFORE INSERT trigger (nextgen_encrypt_message_body) encrypts
    // it before it touches disk and messages_plain decrypts it back out on read.
    let outcome: Awaited<ReturnType<typeof sendTextMessage>>;
    try {
      outcome = await sendTextMessage(user.id, {
        id: optimisticId,
        conversation_id: conversationId!,
        body,
        reply_to_id: replyingTo,
        created_at: createdAt,
      });
    } catch {
      // Unexpected local error: leave it queued; the background sync confirms or retries it.
      outcome = { status: 'queued' };
    }

    if (outcome.status === 'failed') {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(body); // don't lose what they typed
      if (replyingTo) setReplyTarget(messages.find((m) => m.id === replyingTo) ?? null);
      setToast(tr('Message failed to send. Please try again.'));
      return;
    }
    if (outcome.status === 'sent') {
      setMessages((prev) => prev.map((m) => (
        m.id === optimisticId ? { ...m, created_at: outcome.created_at, local_status: undefined } : m
      )));
    }
  };

  const handleAcceptInvite = async (invitationId: string, inv: InviteInfo) => {
    setAcceptingInviteId(invitationId);
    const game = gamesById[inv.game_id];
    const result = await acceptGameInvitation(invitationId, inv.match_id, game?.key ?? null);
    setAcceptingInviteId(null);
    if (!result.ok) { setToast(result.error ?? 'Could not accept invitation.'); return; }
    if (result.playUrl) history.push(result.playUrl, { mode: 'pvp' });
  };

  const handleDeclineInvite = async (invitationId: string) => {
    const result = await declineGameInvitation(invitationId);
    if (!result.ok) setToast(result.error ?? 'Could not decline invitation.');
  };

  const toggleStar = async (messageId: string) => {
    if (!user) return;
    const isStarred = starredIds.has(messageId);
    // optimistic
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (isStarred) next.delete(messageId); else next.add(messageId);
      return next;
    });
    if (isStarred) {
      const { error } = await supabase
        .from('starred_messages')
        .delete()
        .eq('user_id', user.id)
        .eq('message_id', messageId);
      if (error) setToast(tr('Failed to unstar message.'));
    } else {
      const { error } = await supabase
        .from('starred_messages')
        .insert({ user_id: user.id, message_id: messageId });
      if (error) setToast(tr('Failed to star message.'));
    }
  };

  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
    fontSize: 14, cursor: 'pointer', borderBottom: '1px solid var(--ion-border-color)',
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const mine = reactionsByMessage[messageId]?.find((r) => r.user_id === user.id);
    setPressedMessage(null);
    setAnchorRect(null);
    if (mine?.emoji === emoji) {
      // tapping your own current reaction again removes it
      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? []).filter((r) => r.user_id !== user.id),
      }));
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);
      if (error) setToast(tr('Failed to remove reaction.'));
      return;
    }
    setReactionsByMessage((prev) => ({
      ...prev,
      [messageId]: [...(prev[messageId] ?? []).filter((r) => r.user_id !== user.id), { message_id: messageId, user_id: user.id, emoji }],
    }));
    const { error } = await supabase
      .from('message_reactions')
      .upsert({ message_id: messageId, user_id: user.id, emoji }, { onConflict: 'message_id,user_id' });
    if (error) setToast(tr('Failed to react.'));
  };

  // Long-press detection: works for both touch and mouse so it behaves
  // the same in the browser and on-device. A 450ms hold opens the
  // reaction bar + action menu anchored to the bubble that was pressed;
  // moving the pointer more than a few px before that (a scroll, not a
  // hold) cancels it.
  const startPress = (m: Message, e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e ? e.touches[0] : e;
    pressStartPos.current = { x: point.clientX, y: point.clientY };
    const target = e.currentTarget as HTMLElement;
    pressTimerRef.current = setTimeout(() => {
      setPressedMessage(m);
      setAnchorRect(target.getBoundingClientRect());
    }, 450);
  };

  const movePress = (e: React.TouchEvent | React.MouseEvent) => {
    if (!pressTimerRef.current || !pressStartPos.current) return;
    const point = 'touches' in e ? e.touches[0] : e;
    const dx = Math.abs(point.clientX - pressStartPos.current.x);
    const dy = Math.abs(point.clientY - pressStartPos.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const endPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const closeMessageMenu = () => {
    setPressedMessage(null);
    setAnchorRect(null);
  };

  const startReply = (m: Message) => {
    setReplyTarget(m);
    closeMessageMenu();
  };

  const copyMessageText = async (m: Message) => {
    if (m.body) {
      try {
        await navigator.clipboard.writeText(m.body);
        setToast(tr('Copied.'));
      } catch {
        setToast(tr('Could not copy.'));
      }
    }
    closeMessageMenu();
  };

  const handleDownloadImage = async (url: string, messageId: string) => {
    try {
      await downloadChatImage(url, messageId.slice(0, 8));
      setToast(tr('Saved to your gallery.'));
    } catch {
      setToast(tr('Could not save that image.'));
    }
  };

  // Supabase's createSignedUrl only gives back a full URL, not the bare
  // storage path — but the path is embedded in it
  // (.../object/sign/{bucket}/{path}?token=...), so pull it back out
  // for cases (like deletion) that need the raw path instead of the URL.
  const storagePathFromUrl = (url: string): string | null => {
    const match = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  // Hides this message only in the current user's own view — the
  // original row, its media, and everyone else's view are untouched.
  const deleteForMe = async (m: Message) => {
    closeMessageMenu();
    if (!user) return;
    const { error } = await supabase.from('message_deletions').insert({ message_id: m.id, user_id: user.id });
    if (error) {
      setToast(tr('Failed to delete message.'));
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
  };

  // Permanently removes the message (and its media) for every
  // participant — only available to the original sender, and only after
  // an explicit confirmation (see the IonAlert below).
  const deleteForEveryone = async (m: Message) => {
    closeMessageMenu();
    const { data: deleted, error } = await supabase.rpc('delete_message_for_everyone', { p_message_id: m.id });
    if (error) {
      setToast(error.message || 'Failed to delete message.');
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    const mediaUrl = (deleted as { media_url: string | null } | null)?.media_url;
    if (mediaUrl) {
      const path = storagePathFromUrl(mediaUrl);
      if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    }
  };

  const jumpToMessage = (messageId: string) => {
    document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Single place that knows how to name whoever sent a message — "You"
  // for yourself, the peer's name in a direct chat, or the right group
  // member's name in a group. Reply-quote labels and the "X is typing…"
  // line both go through this so group chats resolve real names instead
  // of the "them" placeholder that only ever made sense for direct chats.
  const nameFor = (userId: string | undefined | null): string => {
    if (!userId) return 'Someone';
    if (userId === user?.id) return 'You';
    if (isGroup) return participantNames[userId] ?? 'Someone';
    return peer?.full_name ?? 'them';
  };

  // Deterministic per-sender color for group chat name labels, so the
  // same person always gets the same color across a session — same idea
  // WhatsApp uses, just hashed from the user id instead of assigned by
  // join order (no extra state/column needed).
  const senderColor = (userId: string): string => {
    let hash = 0;
    for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 65%)`;
  };

  const inferMediaType = (file: File): Message['media_type'] => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || !conversationId) return;
    setUploading(true);
    // Same fix as sendMessage() above, same reason: don't wait on the
    // realtime round trip before the sender sees their own attachment.
    const optimisticId = crypto.randomUUID();
    const localPreviewUrl = URL.createObjectURL(file);
    const mediaType = inferMediaType(file);
    setMessages((prev) => [...prev, {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      body: null,
      media_url: localPreviewUrl,
      media_type: mediaType,
      created_at: new Date().toISOString(),
      is_encrypted: false,
      reply_to_id: null,
      game_invitation_id: null,
    }]);
    setTimeout(() => contentRef.current?.scrollToBottom(200), 50);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
      });
      if (uploadError) throw uploadError;
      const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          media_url: signed?.signedUrl,
          media_type: mediaType,
          is_encrypted: false,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      URL.revokeObjectURL(localPreviewUrl);
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        if (withoutOptimistic.some((m) => m.id === data.id)) return withoutOptimistic;
        return [...withoutOptimistic, {
          id: data.id,
          conversation_id: conversationId,
          sender_id: user.id,
          body: null,
          media_url: signed?.signedUrl ?? null,
          media_type: mediaType,
          created_at: new Date().toISOString(),
          is_encrypted: false,
          reply_to_id: null,
          game_invitation_id: null,
        }];
      });
    } catch (err) {
      URL.revokeObjectURL(localPreviewUrl);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setToast(err instanceof Error ? err.message : tr('Failed to send attachment.'));
    } finally {
      setUploading(false);
    }
  };

  // --- Voice notes: record, cancel, or send ---
  useEffect(() => () => {
    if (recordingStreamRef.current) {
      recordingCancelledRef.current = true;
      mediaRecorderRef.current?.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];
      recordingCancelledRef.current = false;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (recordingCancelledRef.current || recordedChunksRef.current.length === 0) return;
        await uploadVoiceNote(new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setToast(tr('Microphone access is needed to record a voice note.'));
    }
  };

  const cancelRecording = () => {
    recordingCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const stopAndSendRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const uploadVoiceNote = async (blob: Blob) => {
    if (!user || !conversationId) return;
    setUploading(true);
    // Same fix as sendMessage() and handleFilePick() above: show it the
    // instant recording finishes rather than waiting on realtime to echo
    // the saved row back — that round trip (or, worse, a subscription
    // that hadn't finished authorizing yet on this visit) is what made a
    // sent voice note only appear after leaving and reopening the chat.
    const optimisticId = crypto.randomUUID();
    const localPreviewUrl = URL.createObjectURL(blob);
    setMessages((prev) => [...prev, {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      body: null,
      media_url: localPreviewUrl,
      media_type: 'audio',
      created_at: new Date().toISOString(),
      is_encrypted: false,
      reply_to_id: null,
      game_invitation_id: null,
    }]);
    setTimeout(() => contentRef.current?.scrollToBottom(200), 50);
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
        contentType: blob.type || 'audio/webm',
      });
      if (uploadError) throw uploadError;
      const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          media_url: signed?.signedUrl,
          media_type: 'audio',
          is_encrypted: false,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      URL.revokeObjectURL(localPreviewUrl);
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        if (withoutOptimistic.some((m) => m.id === data.id)) return withoutOptimistic;
        return [...withoutOptimistic, {
          id: data.id,
          conversation_id: conversationId,
          sender_id: user.id,
          body: null,
          media_url: signed?.signedUrl ?? null,
          media_type: 'audio',
          created_at: new Date().toISOString(),
          is_encrypted: false,
          reply_to_id: null,
          game_invitation_id: null,
        }];
      });
    } catch (err) {
      URL.revokeObjectURL(localPreviewUrl);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setToast(err instanceof Error ? err.message : tr('Failed to send voice note.'));
    } finally {
      setUploading(false);
    }
  };


  // decrypted these server-side — no client-side decryption step anymore).
  const searchMatches = searchTerm.trim()
    ? messages.filter((m) => {
        const text = m.body;
        return typeof text === 'string' && text.toLowerCase().includes(searchTerm.trim().toLowerCase());
      }).map((m) => m.id)
    : [];

  const jumpToMatch = (idx: number) => {
    if (searchMatches.length === 0) return;
    const clamped = ((idx % searchMatches.length) + searchMatches.length) % searchMatches.length;
    setSearchMatchIdx(clamped);
    document.getElementById(`message-${searchMatches[clamped]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    if (searchTerm.trim()) jumpToMatch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm('');
    setSearchMatchIdx(0);
  };

  const callPeer = (type: 'audio' | 'video') => {
    if (!peer || !conversationId) return;
    startCall({
      peerId: peer.id,
      peerName: peer.full_name,
      peerAvatar: peer.avatar_url,
      conversationId,
      type,
    });
  };

  // group consecutive messages by calendar day so we can drop in date dividers
  const withDividers: Array<{ type: 'divider'; iso: string } | { type: 'message'; message: Message }> = [];
  let lastDay = '';
  messages.forEach((m) => {
    // A message whose body never decrypted (blank body, no media, but
    // flagged encrypted) isn't a deleted message — those are removed from
    // `messages` entirely elsewhere in this file and never reach here.
    // This is specifically the historical Sept 2–5 window where a broken
    // encryption function produced unrecoverable ciphertext (see
    // nextgen_msg_decrypt) — there's no plaintext to ever recover for
    // these, so there's nothing useful a placeholder bubble could show.
    // Same treatment as a deleted message: it just isn't rendered.
    const isUnrecoverable = !m.body && !m.media_url && m.is_encrypted;
    if (isUnrecoverable) return;
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) {
      withDividers.push({ type: 'divider', iso: m.created_at });
      lastDay = day;
    }
    withDividers.push({ type: 'message', message: m });
  });

  // "typing…" in a direct chat (there's only one other person, no need
  // to name them); "<name> is typing…" in a group, since it's ambiguous
  // otherwise. Matches how WhatsApp itself distinguishes the two.
  const typingLabel = (() => {
    if (typingUserIds.length === 0) return '';
    if (!isGroup) return 'typing…';
    const names = typingUserIds.map((id) => nameFor(id));
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  })();

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/chats" text="" />
            <BrandMark size={18} className="ng-header-logo" />
            {peer && (
              <div style={{ marginLeft: 4 }}>
                <TrustBadge
                  trustLevel={peer.trust_level}
                  avatarUrl={peer.avatar_url}
                  initials={(peer.full_name || '?').slice(0, 1).toUpperCase()}
                  size={36}
                />
              </div>
            )}
            <div style={{ marginLeft: 10, lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{isGroup ? (groupTitle ?? tr('Group')) : (peer?.full_name ?? tr('Chat'))}</div>
              <div style={{ fontSize: 12, color: typingUserIds.length > 0 ? 'var(--ng-blue)' : peerOnline ? 'var(--ng-blue)' : 'var(--ion-color-medium)' }}>
                {typingUserIds.length > 0 ? typingLabel : isGroup ? `${memberCount} members` : peerOnline ? tr('Online') : ''}
              </div>
            </div>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton fill="clear" onClick={() => callPeer('video')}>
              <IonIcon icon={videocamOutline} slot="icon-only" />
            </IonButton>
            <IonButton fill="clear" onClick={() => callPeer('audio')}>
              <IonIcon icon={callOutline} slot="icon-only" />
            </IonButton>
            <IonButton fill="clear" onClick={() => setSearchOpen((s) => !s)}>
              <IonIcon icon={searchOutline} slot="icon-only" />
            </IonButton>
            <IonButton fill="clear" onClick={() => setMenuOpen(true)}>
              <IonIcon icon={ellipsisVerticalOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {searchOpen && (
          <IonToolbar>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
              <IonSearchbar
                value={searchTerm}
                onIonInput={(e) => setSearchTerm(e.detail.value ?? '')}
                placeholder={tr('Search in this chat')}
                style={{ flex: 1, padding: 0 }}
                debounce={150}
              />
              <div style={{ fontSize: 12, color: 'var(--ion-color-medium)', whiteSpace: 'nowrap' }}>
                {searchTerm.trim() ? (searchMatches.length > 0 ? `${searchMatchIdx + 1}/${searchMatches.length}` : '0/0') : ''}
              </div>
              <IonButton fill="clear" size="small" disabled={searchMatches.length === 0} onClick={() => jumpToMatch(searchMatchIdx - 1)}>
                <IonIcon icon={chevronUp} slot="icon-only" />
              </IonButton>
              <IonButton fill="clear" size="small" disabled={searchMatches.length === 0} onClick={() => jumpToMatch(searchMatchIdx + 1)}>
                <IonIcon icon={chevronDown} slot="icon-only" />
              </IonButton>
              <IonButton fill="clear" size="small" onClick={closeSearch}>
                <IonIcon icon={close} slot="icon-only" />
              </IonButton>
            </div>
          </IonToolbar>
        )}
      </IonHeader>
      <IonContent ref={contentRef} className="ion-padding">
        {withDividers.map((entry, idx) => {
          if (entry.type === 'divider') {
            return <DateDivider key={`divider-${idx}`} iso={entry.iso} />;
          }
          const m = entry.message;
          const mine = m.sender_id === user?.id;
          const isStarred = starredIds.has(m.id);
          const isHighlighted = highlightMessageId === m.id || searchMatches[searchMatchIdx] === m.id;
          const hasText = !!m.body;
          const repliedTo = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
          const reactions = reactionsByMessage[m.id] ?? [];
          const reactionCounts = reactions.reduce<Record<string, number>>((acc, r) => {
            acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
            return acc;
          }, {});
          return (
            <div
              key={m.id}
              id={`message-${m.id}`}
              style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: Object.keys(reactionCounts).length ? 16 : 8, gap: 4, alignItems: 'center' }}
            >
              {mine && (
                <IonIcon
                  icon={isStarred ? star : starOutline}
                  onClick={() => toggleStar(m.id)}
                  style={{ fontSize: 15, color: isStarred ? 'var(--ng-blue)' : 'var(--ion-color-medium)', cursor: 'pointer', flexShrink: 0 }}
                />
              )}
              <div
                onTouchStart={(e) => startPress(m, e)}
                onTouchMove={movePress}
                onTouchEnd={endPress}
                onMouseDown={(e) => startPress(m, e)}
                onMouseMove={movePress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                style={{
                  position: 'relative',
                  maxWidth: '75%',
                  padding: '9px 13px',
                  borderRadius: 16,
                  background: mine ? 'var(--ng-blue)' : 'var(--ion-item-background)',
                  color: mine ? '#fff' : 'var(--ion-text-color)',
                  boxShadow: isHighlighted ? '0 0 0 2px var(--ng-blue)' : undefined,
                  transition: 'box-shadow 0.3s',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
              >
                {isGroup && !mine && (
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: senderColor(m.sender_id) }}>
                    {nameFor(m.sender_id)}
                  </div>
                )}
                {repliedTo && (
                  <div
                    onClick={() => jumpToMessage(repliedTo.id)}
                    style={{
                      borderLeft: '3px solid rgba(255,255,255,0.6)',
                      background: 'rgba(0,0,0,0.15)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      marginBottom: 6,
                      cursor: 'pointer',
                      opacity: 0.9,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700 }}>
                      {nameFor(repliedTo.sender_id)}
                    </div>
                    <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {repliedTo.body || (repliedTo.media_url ? tr('Attachment') : tr('Message unavailable'))}
                    </div>
                  </div>
                )}
                {m.game_invitation_id ? (
                  (() => {
                    const inv = invitesById[m.game_invitation_id];
                    const game = inv ? gamesById[inv.game_id] : undefined;
                    if (!inv || !game) {
                      return <div style={{ fontStyle: 'italic', opacity: 0.8 }}>{tr('Game invitation')}</div>;
                    }
                    const otherName = mine ? nameFor(inv.recipient_id ?? '') : nameFor(inv.sender_id);
                    return (
                      <div style={{ minWidth: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 22 }}>{game.icon ?? '🎮'}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{game.name}</div>
                            <div style={{ fontSize: 11, opacity: 0.85 }}>
                              {mine ? `You invited ${otherName} to play` : `${otherName} invited you to play`}
                            </div>
                          </div>
                        </div>
                        {inv.status === 'pending' && !mine && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              onClick={() => handleAcceptInvite(m.game_invitation_id!, inv)}
                              disabled={acceptingInviteId === m.game_invitation_id}
                              style={{
                                flex: 1, background: '#fff', color: 'var(--ng-blue)', border: 'none',
                                borderRadius: 10, padding: '7px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                              }}
                            >
                              {tr('Accept')}
                            </button>
                            <button
                              onClick={() => handleDeclineInvite(m.game_invitation_id!)}
                              style={{
                                flex: 1, background: 'rgba(255,255,255,0.18)', color: 'inherit', border: 'none',
                                borderRadius: 10, padding: '7px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                              }}
                            >
                              {tr('Decline')}
                            </button>
                          </div>
                        )}
                        {inv.status === 'pending' && mine && (
                          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{tr('Waiting for a response…')}</div>
                        )}
                        {inv.status === 'accepted' && (
                          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4, fontWeight: 600 }}>{tr('✓ Accepted')}</div>
                        )}
                        {inv.status === 'declined' && (
                          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{tr('Declined')}</div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <>
                    <MediaBubble message={m} onDownload={handleDownloadImage} />
                    {hasText && <div>{m.body}</div>}
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontSize: 10, opacity: 0.9, marginTop: 3 }}>
                  <span style={{ opacity: 0.8 }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {mine && (m.local_status
                    ? <IonIcon icon={timeOutline} style={{ fontSize: 14, opacity: 0.7 }} />
                    : <MessageTicks receipts={receiptsByMessage[m.id] ?? []} />)}
                </div>
                {Object.keys(reactionCounts).length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -12,
                      [mine ? 'right' : 'left']: 8,
                      display: 'flex',
                      gap: 2,
                      background: 'var(--ion-toolbar-background)',
                      border: '1px solid var(--ion-border-color)',
                      borderRadius: 10,
                      padding: '1px 5px',
                      fontSize: 12,
                    } as React.CSSProperties}
                  >
                    {Object.entries(reactionCounts).map(([emoji, count]) => (
                      <span key={emoji}>{emoji}{count > 1 ? count : ''}</span>
                    ))}
                  </div>
                )}
              </div>
              {!mine && (
                <IonIcon
                  icon={isStarred ? star : starOutline}
                  onClick={() => toggleStar(m.id)}
                  style={{ fontSize: 15, color: isStarred ? 'var(--ng-blue)' : 'var(--ion-color-medium)', cursor: 'pointer', flexShrink: 0 }}
                />
              )}
            </div>
          );
        })}
      </IonContent>

      {/* Floating reaction bar + action menu, shown on long-press. Anchored
          to the pressed bubble's screen position rather than a fixed
          overlay so it always appears right next to what was held. */}
      {pressedMessage && anchorRect && (
        <div
          onClick={closeMessageMenu}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: Math.max(8, anchorRect.top - 130),
              left: Math.min(Math.max(8, anchorRect.left), window.innerWidth - 300),
              width: 280,
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-around', alignItems: 'center',
              background: 'var(--ion-toolbar-background)', border: '1px solid var(--ion-border-color)',
              borderRadius: 24, padding: '6px 10px', marginBottom: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              {QUICK_REACTIONS.map((emoji) => (
                <span
                  key={emoji}
                  onClick={() => toggleReaction(pressedMessage.id, emoji)}
                  style={{ fontSize: 22, cursor: 'pointer' }}
                >
                  {emoji}
                </span>
              ))}
            </div>
            <div style={{
              background: 'var(--ion-toolbar-background)', border: '1px solid var(--ion-border-color)',
              borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              <div onClick={() => startReply(pressedMessage)} style={rowStyle}>
                <IonIcon icon={arrowUndoOutline} style={{ fontSize: 16 }} /> {tr('Reply')}
              </div>
              {pressedMessage.body && (
                <div onClick={() => copyMessageText(pressedMessage)} style={rowStyle}>
                  <IonIcon icon={copyOutline} style={{ fontSize: 16 }} /> {tr('Copy')}
                </div>
              )}
              <div onClick={() => { toggleStar(pressedMessage.id); closeMessageMenu(); }} style={rowStyle}>
                <IonIcon icon={starredIds.has(pressedMessage.id) ? star : starOutline} style={{ fontSize: 16 }} />
                {starredIds.has(pressedMessage.id) ? tr('Unstar') : tr('Star')}
              </div>
              <div onClick={() => deleteForMe(pressedMessage)} style={{ ...rowStyle, color: 'var(--ng-security-red, #eb445a)' }}>
                <IonIcon icon={trashOutline} style={{ fontSize: 16 }} /> {tr('Delete for me')}
              </div>
              {pressedMessage.sender_id === user?.id && (
                <div onClick={() => { setPressedMessage(null); setAnchorRect(null); setConfirmDeleteForEveryone(pressedMessage); }} style={{ ...rowStyle, color: 'var(--ng-security-red, #eb445a)', borderBottom: 'none' }}>
                  <IonIcon icon={trashOutline} style={{ fontSize: 16 }} /> {tr('Delete for Everyone')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <IonFooter className="ion-no-border">
        {replyTarget && (
          <IonToolbar>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              borderLeft: '3px solid var(--ng-blue)', background: 'var(--ion-item-background)', borderRadius: 8,
            }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ng-blue)' }}>
                  {tr('Replying to')} {replyTarget.sender_id === user?.id ? tr('yourself') : nameFor(replyTarget.sender_id)}
                </div>
                <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>
                  {replyTarget.body || (replyTarget.media_url ? tr('Attachment') : tr('Message unavailable'))}
                </div>
              </div>
              <IonButton fill="clear" size="small" onClick={() => setReplyTarget(null)}>
                <IonIcon icon={close} slot="icon-only" />
              </IonButton>
            </div>
          </IonToolbar>
        )}
        <IonToolbar>
          {isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
              <IonButton fill="clear" onClick={cancelRecording}>
                <IonIcon icon={trashOutline} slot="icon-only" style={{ color: 'var(--ng-security-red, #eb445a)' }} />
              </IonButton>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: 'var(--ng-security-red, #eb445a)',
                  animation: 'ng-rec-pulse 1.2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 14 }}>
                  {tr('Recording…')} {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                </span>
              </div>
              <IonButton
                fill="solid" shape="round" onClick={stopAndSendRecording}
                style={{ '--background': 'var(--ng-blue)', width: 40, height: 40, margin: 0 } as React.CSSProperties}
              >
                <IonIcon icon={send} slot="icon-only" style={{ color: '#fff' }} />
              </IonButton>
              <style>{`@keyframes ng-rec-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
              <IonButton fill="clear" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <IonSpinner name="dots" /> : <IonIcon icon={imageOutline} slot="icon-only" />}
              </IonButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFilePick}
              />
              <IonTextarea
                autoGrow
                rows={1}
                placeholder={tr('Type a message')}
                value={draft}
                onIonInput={(e) => {
                  setDraft(e.detail.value ?? '');
                  notifyTyping();
                }}
                onKeyDown={(e) => {
                  // Desktop browsers: Enter sends, Shift+Enter makes a new line. On phones (touch devices)
                  // Enter keeps making a new line; the send button sends.
                  const isTouch = window.matchMedia('(pointer: coarse)').matches;
                  if (e.key === 'Enter' && !e.shiftKey && !isTouch && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                style={{ flex: 1, background: 'var(--ion-item-background)', borderRadius: 18, padding: '4px 12px' }}
              />
              <IonButton
                fill="solid"
                shape="round"
                aria-label={draft.trim() ? tr('Send message') : tr('Record a voice note')}
                onClick={draft.trim() ? sendMessage : startRecording}
                disabled={uploading}
                style={{
                  '--background': draft.trim() ? 'var(--ng-blue)' : 'var(--ion-item-background, #2a2a2e)',
                  '--background-hover': draft.trim() ? 'var(--ng-blue)' : 'var(--ion-item-background, #2a2a2e)',
                  '--border-width': draft.trim() ? '0' : '1px',
                  '--border-color': 'var(--ng-blue)',
                  '--border-style': 'solid',
                  width: 40, height: 40, margin: 0,
                } as React.CSSProperties}
              >
                <IonIcon
                  icon={draft.trim() ? send : micOutline}
                  slot="icon-only"
                  style={{ color: draft.trim() ? '#fff' : 'var(--ng-blue)' }}
                />
              </IonButton>
            </div>
          )}
        </IonToolbar>
      </IonFooter>
      <IonAlert
        isOpen={!!confirmDeleteForEveryone}
        onDidDismiss={() => setConfirmDeleteForEveryone(null)}
        header={tr('Delete for Everyone?')}
        message={tr('This removes the message for everyone in this chat. This can\'t be undone.')}
        buttons={[
          { text: tr('Cancel'), role: 'cancel' },
          {
            text: tr('Delete for Everyone'),
            role: 'destructive',
            handler: () => {
              if (confirmDeleteForEveryone) deleteForEveryone(confirmDeleteForEveryone);
            },
          },
        ]}
      />
      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      <IonActionSheet
        isOpen={menuOpen}
        onDidDismiss={() => setMenuOpen(false)}
        buttons={[
          {
            text: tr('View contact'),
            icon: personCircleOutline,
            handler: () => history.push(`/chats/room/${conversationId}/contact`),
          },
          {
            text: tr('Search'),
            icon: searchOutline,
            handler: () => setSearchOpen(true),
          },
          {
            text: tr('Media, links, and docs'),
            icon: imagesOutline,
            handler: () => history.push(`/chats/room/${conversationId}/media`),
          },
          {
            text: tr('Mute notifications'),
            icon: notificationsOffOutline,
            handler: async () => {
              if (!user || !conversationId) return;
              const { data } = await supabase
                .from('conversation_participants')
                .select('is_muted')
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id)
                .maybeSingle();
              const next = !((data as any)?.is_muted ?? false);
              await supabase
                .from('conversation_participants')
                .update({ is_muted: next })
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id);
              setToast(next ? tr('Notifications muted for this chat.') : tr('Notifications unmuted.'));
            },
          },
          {
            text: tr('Chat theme'),
            icon: colorPaletteOutline,
            handler: () => setToast(tr('Chat themes are coming soon.')),
          },
          { text: tr('Cancel'), role: 'cancel' },
        ]}
      />
    </IonPage>
  );
};

export default ChatRoom;