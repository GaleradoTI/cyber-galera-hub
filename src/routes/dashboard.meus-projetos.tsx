import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Pencil, MessageSquare, Send, Layers, Target, Check, UserPlus, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "@/components/dashboard/post-card";
import { MemberDetailDialog, type MemberProfile } from "@/components/profile/member-detail-dialog";

export const Route = createFileRoute("/dashboard/meus-projetos")({ component: MeusProjetosPage });

type Project = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; status: string };
type Squad = { id: string; project_id: string; name: string; description: string | null };
type SquadMember = { id: string; squad_id: string; user_id: string; role_in_squad: string };
type Profile = {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  work_area: string | null;
  tech_tags: string[] | null;
  social_links: Record<string, string> | null;
};
type Post = { id: string; project_id: string; user_id: string; content: string; created_at: string };
type GoalTask = { id: string; title: string; done: boolean; done_by?: string | null; done_at?: string | null };
type Goal = { id: string; project_id: string; squad_id: string | null; title: string; description: string | null; due_date: string | null; order_index: number; tasks: GoalTask[] };
type Completion = { id: string; goal_id: string; squad_id: string; completed_by: string | null; completed_at: string; note: string | null };
type JoinRequest = { id: string; project_id: string; squad_id: string | null; user_id: string; status: string; message: string | null; created_at: string };

function MeusProjetosPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
  const [postText, setPostText] = useState<Record<string, string>>({});
  const [openMember, setOpenMember] = useState<{ profile: MemberProfile; role?: string; squadName?: string } | null>(null);
  const [openGoal, setOpenGoal] = useState<Goal | null>(null);

  // squads I belong to
  const { data: mySquadMembership = [] } = useQuery({
    queryKey: ["my-squad-membership", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("squad_members").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as SquadMember[];
    },
  });

  const mySquadIds = useMemo(() => mySquadMembership.map((m) => m.squad_id), [mySquadMembership]);

  const { data: squads = [] } = useQuery({
    queryKey: ["my-squads", mySquadIds.join(",")],
    enabled: mySquadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("squads").select("*").in("id", mySquadIds);
      if (error) throw error;
      return (data ?? []) as Squad[];
    },
  });

  const myProjectIds = useMemo(() => Array.from(new Set(squads.map((s) => s.project_id))), [squads]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["my-projects", myProjectIds.join(",")],
    enabled: myProjectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").in("id", myProjectIds);
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  // all squad members of my squads (to display rosters)
  const { data: allSquadMembers = [] } = useQuery({
    queryKey: ["my-squads-members", mySquadIds.join(",")],
    enabled: mySquadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("squad_members").select("*").in("squad_id", mySquadIds);
      if (error) throw error;
      return (data ?? []) as SquadMember[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(allSquadMembers.map((m) => m.user_id))), [allSquadMembers]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["my-squads-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,email,avatar_url").in("user_id", userIds);
      // tentativa adicional: campos extras (bio/phone/social_links/...) podem ou não estar disponíveis
      // dependendo da política RLS — não bloqueia o carregamento.
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  // segunda query para campos sensíveis liberados pela policy de "Project teammates view profile"
  const { data: teammateProfiles = [] } = useQuery({
    queryKey: ["my-squads-profiles-extra", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,bio,phone,work_area,tech_tags,social_links")
        .in("user_id", userIds);
      if (error) return [];
      return (data ?? []) as any[];
    },
  });
  const extraById = useMemo(() => new Map(teammateProfiles.map((p: any) => [p.user_id, p])), [teammateProfiles]);

  const { data: posts = [] } = useQuery({
    queryKey: ["project-posts", myProjectIds.join(",")],
    enabled: myProjectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_posts").select("*").in("project_id", myProjectIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["my-project-goals", myProjectIds.join(",")],
    enabled: myProjectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squad_goals").select("*").in("project_id", myProjectIds)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((g) => ({ ...g, tasks: Array.isArray(g.tasks) ? g.tasks : [] })) as Goal[];
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["my-goal-completions", mySquadIds.join(",")],
    enabled: mySquadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("squad_goal_completions").select("*").in("squad_id", mySquadIds);
      if (error) throw error;
      return (data ?? []) as Completion[];
    },
  });

  const myLeaderSquadIds = useMemo(
    () => mySquadMembership.filter((m) => m.role_in_squad === "LIDER").map((m) => m.squad_id),
    [mySquadMembership],
  );
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pending-join-requests", myLeaderSquadIds.join(",")],
    enabled: myLeaderSquadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_join_requests").select("*")
        .in("squad_id", myLeaderSquadIds).in("status", ["pending", "waitlist"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JoinRequest[];
    },
  });

  const requesterIds = useMemo(() => Array.from(new Set(pendingRequests.map((r) => r.user_id))), [pendingRequests]);
  const { data: requesterProfiles = [] } = useQuery({
    queryKey: ["join-requesters", requesterIds.join(",")],
    enabled: requesterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,email").in("user_id", requesterIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const requesterById = useMemo(() => new Map(requesterProfiles.map((p) => [p.user_id, p])), [requesterProfiles]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);
  const squadsByProject = useMemo(() => {
    const m = new Map<string, Squad[]>();
    squads.forEach((s) => {
      const arr = m.get(s.project_id) ?? [];
      arr.push(s);
      m.set(s.project_id, arr);
    });
    return m;
  }, [squads]);
  const membersBySquad = useMemo(() => {
    const m = new Map<string, SquadMember[]>();
    allSquadMembers.forEach((x) => {
      const arr = m.get(x.squad_id) ?? [];
      arr.push(x);
      m.set(x.squad_id, arr);
    });
    return m;
  }, [allSquadMembers]);
  const postsByProject = useMemo(() => {
    const m = new Map<string, Post[]>();
    posts.forEach((p) => {
      const arr = m.get(p.project_id) ?? [];
      arr.push(p);
      m.set(p.project_id, arr);
    });
    return m;
  }, [posts]);

  const isSquadLeader = (squadId: string) =>
    mySquadMembership.some((m) => m.squad_id === squadId && m.role_in_squad === "LIDER");

  const saveSquad = async () => {
    if (!editingSquad) return;
    const { error } = await supabase.from("squads").update({
      name: editingSquad.name, description: editingSquad.description,
    }).eq("id", editingSquad.id);
    if (error) return toast.error(error.message);
    toast.success("Squad atualizado");
    setEditingSquad(null);
    qc.invalidateQueries({ queryKey: ["my-squads"] });
    qc.invalidateQueries({ queryKey: ["all-squads"] });
  };

  const sendPost = async (projectId: string) => {
    const content = (postText[projectId] ?? "").trim();
    if (!content) return;
    const { error } = await supabase.from("project_posts").insert({
      project_id: projectId, user_id: user!.id, content,
    });
    if (error) return toast.error(error.message);
    setPostText({ ...postText, [projectId]: "" });
    qc.invalidateQueries({ queryKey: ["project-posts"] });
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("project_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["project-posts"] });
  };

  const toggleGoal = async (goal: Goal, squadId: string) => {
    const done = completions.find((c) => c.goal_id === goal.id && c.squad_id === squadId);
    if (done) {
      const { error } = await supabase.from("squad_goal_completions").delete().eq("id", done.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("squad_goal_completions").insert({
        goal_id: goal.id, squad_id: squadId, completed_by: user!.id,
      });
      if (error) return toast.error(error.message);
      toast.success("Meta marcada como concluída");
    }
    qc.invalidateQueries({ queryKey: ["my-goal-completions"] });
  };

  const toggleTask = async (goal: Goal, task: GoalTask) => {
    const { error } = await (supabase as any).rpc("toggle_goal_task", {
      _goal_id: goal.id, _task_id: task.id, _done: !task.done,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-project-goals"] });
  };

  const decideRequest = async (id: string, action: "approved" | "rejected" | "waitlist") => {
    const req = pendingRequests.find((r) => r.id === id);
    const reqName = req ? (requesterById.get(req.user_id)?.display_name ?? requesterById.get(req.user_id)?.email ?? "membro") : "membro";
    const squadName = req ? (squads.find((s) => s.id === req.squad_id)?.name ?? "squad") : "squad";
    const labels: Record<typeof action, { loading: string; success: string }> = {
      approved: { loading: `Aprovando ${reqName}…`, success: `${reqName} foi adicionado(a) ao squad "${squadName}"` },
      rejected: { loading: `Rejeitando solicitação de ${reqName}…`, success: `Solicitação de ${reqName} rejeitada` },
      waitlist: { loading: `Movendo ${reqName} para a espera…`, success: `${reqName} entrou na lista de espera de "${squadName}"` },
    };
    await toast.promise(
      (async () => {
        const { error } = await (supabase as any).rpc("decide_join_request", { _id: id, _action: action, _note: null });
        if (error) throw error;
      })(),
      {
        loading: labels[action].loading,
        success: labels[action].success,
        error: (e: any) => `Não foi possível concluir: ${e?.message ?? "erro desconhecido"}`,
      },
    );
    qc.invalidateQueries({ queryKey: ["pending-join-requests"] });
    qc.invalidateQueries({ queryKey: ["my-squads-members"] });
    qc.invalidateQueries({ queryKey: ["my-squad-membership"] });
  };

  return (
    <DashboardShell title="Meus Projetos" description="Projetos e squads em que você participa.">
      {(!user || isLoading) && <p className="text-muted-foreground text-sm">Carregando…</p>}
      {!isLoading && projects.length === 0 && (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">
          Você ainda não foi adicionado a nenhum squad. O SUPER ADMIN pode incluir você.
        </div>
      )}

      <div className="space-y-6">
        {pendingRequests.length > 0 && (
          <div className="glass rounded-xl p-5 border border-secondary/40">
            <div className="text-[10px] font-bold tracking-[0.25em] text-secondary mb-3 flex items-center gap-1">
              <UserPlus className="h-3 w-3" /> SOLICITAÇÕES DE ENTRADA ({pendingRequests.length})
            </div>
            <div className="space-y-2">
              {pendingRequests.map((r) => {
                const p = requesterById.get(r.user_id);
                const squad = squads.find((s) => s.id === r.squad_id);
                return (
                  <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/10 p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{p?.display_name ?? p?.email ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {squad?.name ?? "—"} · {r.status === "waitlist" ? "Espera" : "Pendente"}
                      </div>
                      {r.message && <p className="text-xs mt-1 text-muted-foreground italic">"{r.message}"</p>}
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <Button size="sm" onClick={() => decideRequest(r.id, "approved")}><Check className="h-3 w-3 mr-1" />Aceitar</Button>
                      {r.status !== "waitlist" && <Button size="sm" variant="outline" onClick={() => decideRequest(r.id, "waitlist")}><Clock className="h-3 w-3" /></Button>}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => decideRequest(r.id, "rejected")}>Rejeitar</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {projects.map((p) => {
          const projectSquads = squadsByProject.get(p.id) ?? [];
          const projectPosts = postsByProject.get(p.id) ?? [];
          const projectGoals = goals.filter((g) => g.project_id === p.id);
          const totalMembers = projectSquads.reduce((acc, s) => acc + (membersBySquad.get(s.id)?.length ?? 0), 0);
          return (
            <div key={p.id} className="glass rounded-xl p-6 border border-primary/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground mt-2">{p.description}</p>}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="rounded-md bg-muted/20 p-3 text-center">
                  <div className="text-2xl font-black text-gradient-neon">{projectSquads.length}</div>
                  <div className="text-[10px] tracking-widest text-muted-foreground">SQUADS</div>
                </div>
                <div className="rounded-md bg-muted/20 p-3 text-center">
                  <div className="text-2xl font-black text-gradient-neon">{totalMembers}</div>
                  <div className="text-[10px] tracking-widest text-muted-foreground">MEMBROS</div>
                </div>
                <div className="rounded-md bg-muted/20 p-3 text-center">
                  <div className="text-2xl font-black text-gradient-neon">{projectPosts.length}</div>
                  <div className="text-[10px] tracking-widest text-muted-foreground">POSTS</div>
                </div>
              </div>

              {/* Metas */}
              {projectGoals.length > 0 && (
                <div className="mt-5">
                  <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2 flex items-center gap-1">
                    <Target className="h-3 w-3" /> METAS
                  </div>
                  <div className="space-y-2">
                    {projectGoals.map((g) => {
                      const overdue = g.due_date && new Date(g.due_date) < new Date() && !completions.some((c) => c.goal_id === g.id);
                      const canManage =
                        projectSquads.some((s) => isSquadLeader(s.id));
                      const doneCount = g.tasks.filter((t) => t.done).length;
                      return (
                        <div key={g.id} className="rounded-lg border border-border/40 p-3 bg-muted/10">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">{g.title}</div>
                              {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                              {g.due_date && (
                                <div className={`text-[10px] mt-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                                  Prazo: {new Date(g.due_date).toLocaleDateString("pt-BR")} {overdue && "(atrasado)"}
                                </div>
                              )}
                            </div>
                          </div>
                          {g.tasks.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-[10px] tracking-widest text-muted-foreground/70">
                                CHECKLIST — {doneCount}/{g.tasks.length}
                              </div>
                              {g.tasks.map((t) => (
                                <label key={t.id} className={`flex items-center gap-2 text-xs ${canManage ? "cursor-pointer" : "cursor-default"}`}>
                                  <input
                                    type="checkbox"
                                    checked={t.done}
                                    disabled={!canManage}
                                    onChange={() => toggleTask(g, t)}
                                    className="accent-primary"
                                  />
                                  <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                                </label>
                              ))}
                              {!canManage && (
                                <p className="text-[10px] text-muted-foreground italic">Somente líderes marcam tasks.</p>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {projectSquads
                              .filter((s) => !g.squad_id || g.squad_id === s.id)
                              .map((s) => {
                                const done = completions.find((c) => c.goal_id === g.id && c.squad_id === s.id);
                                const member = mySquadIds.includes(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    disabled={!member}
                                    onClick={() => toggleGoal(g, s.id)}
                                    className={`text-[11px] px-2 py-1 rounded border transition ${done
                                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                      : "bg-background/50 border-border/40 hover:border-primary/40"}`}
                                  >
                                    {done ? "✓ " : ""}{s.name}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Squads */}
              <div className="mt-5">
                <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2 flex items-center gap-1">
                  <Layers className="h-3 w-3" /> SQUADS
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {projectSquads.map((s) => {
                    const ms = membersBySquad.get(s.id) ?? [];
                    const leader = isSquadLeader(s.id);
                    return (
                      <div key={s.id} className="rounded-lg border border-border/40 p-3 bg-muted/10">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-sm">{s.name}</div>
                              {leader && <Badge variant="outline" className="border-secondary text-secondary text-[10px]"><Crown className="h-3 w-3 mr-1" />Líder</Badge>}
                            </div>
                            {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                          </div>
                          {leader && (
                            <Button size="sm" variant="ghost" onClick={() => setEditingSquad(s)}><Pencil className="h-3 w-3" /></Button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ms.map((m) => {
                            const u = profileById.get(m.user_id);
                            const extra = extraById.get(m.user_id) ?? {};
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() =>
                                  setOpenMember({
                                    profile: {
                                      user_id: m.user_id,
                                      display_name: u?.display_name ?? null,
                                      avatar_url: u?.avatar_url ?? null,
                                      email: u?.email ?? null,
                                      bio: extra.bio ?? null,
                                      phone: extra.phone ?? null,
                                      work_area: extra.work_area ?? null,
                                      tech_tags: extra.tech_tags ?? null,
                                      social_links: extra.social_links ?? null,
                                    },
                                    role: m.role_in_squad,
                                    squadName: s.name,
                                  })
                                }
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-background/60 text-xs hover:bg-primary/15 hover:text-primary transition"
                              >
                                {m.role_in_squad === "LIDER" && <Crown className="h-3 w-3 text-secondary" />}
                                <span>{u?.display_name ?? "—"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mural */}
              <div className="mt-5 pt-4 border-t border-border/40">
                <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> MURAL
                </div>
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Compartilhe algo com o squad…"
                    value={postText[p.id] ?? ""}
                    onChange={(e) => setPostText({ ...postText, [p.id]: e.target.value })}
                  />
                  <Button onClick={() => sendPost(p.id)} disabled={!(postText[p.id] ?? "").trim()}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {projectPosts.map((post) => {
                    const author = profileById.get(post.user_id);
                    return (
                      <PostCard
                        key={post.id}
                        post={post}
                        author={author}
                        currentUserId={user!.id}
                        profileById={profileById}
                        onDelete={() => deletePost(post.id)}
                      />
                    );
                  })}
                  {projectPosts.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum post ainda.</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editingSquad} onOpenChange={(o) => !o && setEditingSquad(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar squad</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editingSquad?.name ?? ""} onChange={(e) => setEditingSquad({ ...editingSquad!, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={4} value={editingSquad?.description ?? ""} onChange={(e) => setEditingSquad({ ...editingSquad!, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingSquad(null)}>Cancelar</Button>
            <Button onClick={saveSquad}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberDetailDialog
        open={!!openMember}
        onOpenChange={(o) => !o && setOpenMember(null)}
        profile={openMember?.profile ?? null}
        role={openMember?.role}
        squadName={openMember?.squadName}
      />
    </DashboardShell>
  );
}