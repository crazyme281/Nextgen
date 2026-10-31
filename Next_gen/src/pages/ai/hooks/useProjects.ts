import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Tables } from "@/types/database.types";

type Project = Tables<"ai_projects">;

export function useProjects(userId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && data) setProjects(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createProject(name = "New Project"): Promise<Project | null> {
    const { data, error } = await supabase
      .from("ai_projects")
      .insert({ name })
      .select()
      .single();
    if (error || !data) return null;
    setProjects((prev) => [data, ...prev]);
    return data;
  }

  async function renameProject(id: string, name: string) {
    await supabase.from("ai_projects").update({ name }).eq("id", id);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  async function deleteProject(id: string) {
    await supabase.from("ai_projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return { projects, loading, createProject, renameProject, deleteProject, refresh };
}
