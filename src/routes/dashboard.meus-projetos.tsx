import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Pencil, Users as UsersIcon, MessageSquare, Send, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/meus-projetos")({ component: MeusProjetosPage });

type Project = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; status: string };
type Squad = { id: string; project_id: string; name: string; description: string | null };
type SquadMember = { id: string; squad_id: string; user_id: string; role_in_squad: string };
type Profile = { user_id: string; display_name: string; email: string };
type Post = { id: string; project_id: string; user_id: string; content: string; created_at: string };

function MeusProjetosPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
  const [postText, setPostText] = useState<Record<string, string>>({});

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
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,email").in("user_id", userIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

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

  return (
    <DashboardShell title="Meus Projetos" description="Projetos e squads em que você participa.">
      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
      {!isLoading && projects.length === 0 && (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">
          Você ainda não foi adicionado a nenhum squad. O SUPER ADMIN pode incluir você.
        </div>
      )}

      <div className="space-y-6">
        {projects.map((p) => {
          const projectSquads = squadsByProject.get(p.id) ?? [];
          const projectPosts = postsByProject.get(p.id) ?? [];
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
                            return (
                              <div key={m.id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-background/60 text-xs">
                                {m.role_in_squad === "LIDER" && <Crown className="h-3 w-3 text-secondary" />}
                                <span>{u?.display_name ?? "—"}</span>
                              </div>
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
                    const mine = post.user_id === user?.id;
                    return (
                      <div key={post.id} className="rounded-md border border-border/30 p-3 bg-muted/10">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{author?.display_name ?? "Usuário"}</span>
                            {" • "}
                            {new Date(post.created_at).toLocaleString("pt-BR")}
                          </div>
                          {mine && (
                            <Button size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0" onClick={() => deletePost(post.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{post.content}</p>
                      </div>
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
    </DashboardShell>
  );
}