import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users as UsersIcon, Crown, Layers, Globe, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ui/image-uploader";

export const Route = createFileRoute("/dashboard/projetos")({ component: ProjetosAdminPage });

type Project = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; banner_url: string | null; status: string; created_at: string; is_public: boolean; tech_stack: string[] };
type Squad = { id: string; project_id: string; name: string; description: string | null };
type SquadMember = { id: string; squad_id: string; user_id: string; role_in_squad: string };
type Profile = { user_id: string; display_name: string; email: string };

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 60);

function ProjetosAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [techInput, setTechInput] = useState("");
  const [managingProject, setManagingProject] = useState<Project | null>(null);
  const [editingSquad, setEditingSquad] = useState<Partial<Squad> | null>(null);
  const [managingSquad, setManagingSquad] = useState<Squad | null>(null);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("MEMBRO");
  const [memberSearch, setMemberSearch] = useState("");
  // All squad-member rows for the current project, used to filter the
  // "add member" list and enforce the 1-squad-per-project rule on the client.
  const { data: projectMemberships = [] } = useQuery({
    queryKey: ["project-memberships", managingSquad?.id, managingProject?.id],
    enabled: !!managingSquad?.id,
    queryFn: async () => {
      const project_id = (allSquads.find((s) => s.id === managingSquad!.id)?.project_id) ?? null;
      if (!project_id) return [] as SquadMember[];
      const squadIdsInProject = allSquads.filter((s) => s.project_id === project_id).map((s) => s.id);
      const { data, error } = await supabase
        .from("squad_members").select("*").in("squad_id", squadIdsInProject);
      if (error) throw error;
      return (data ?? []) as SquadMember[];
    },
  });
  const usersAlreadyInProject = useMemo(() => new Set(projectMemberships.map((m) => m.user_id)), [projectMemberships]);

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const { data: allSquads = [] } = useQuery({
    queryKey: ["all-squads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("squads").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Squad[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,email").order("display_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: squadMembers = [] } = useQuery({
    queryKey: ["squad-members", managingSquad?.id],
    enabled: !!managingSquad?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("squad_members").select("*").eq("squad_id", managingSquad!.id);
      if (error) throw error;
      return (data ?? []) as SquadMember[];
    },
  });

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);
  const squadsByProject = useMemo(() => {
    const m = new Map<string, Squad[]>();
    allSquads.forEach((s) => {
      const arr = m.get(s.project_id) ?? [];
      arr.push(s);
      m.set(s.project_id, arr);
    });
    return m;
  }, [allSquads]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-projects"] });
    qc.invalidateQueries({ queryKey: ["all-squads"] });
    qc.invalidateQueries({ queryKey: ["squad-members"] });
    qc.invalidateQueries({ queryKey: ["my-projects"] });
    qc.invalidateQueries({ queryKey: ["my-squads"] });
  };

  const saveProject = async () => {
    if (!editing?.name) return toast.error("Nome obrigatório");
    const payload = {
      name: editing.name!,
      slug: editing.slug || slugify(editing.name!),
      description: editing.description ?? null,
      cover_url: editing.cover_url ?? null,
      banner_url: editing.banner_url ?? null,
      status: editing.status ?? "ativo",
      is_public: !!editing.is_public,
      tech_stack: editing.tech_stack ?? [],
    };
    const { error } = editing.id
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Projeto salvo");
    setEditing(null);
    setTechInput("");
    refreshAll();
  };

  const removeProject = async (p: Project) => {
    if (!confirm(`Excluir projeto "${p.name}" e todos seus squads?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Projeto removido");
    refreshAll();
  };

  const saveSquad = async () => {
    if (!editingSquad?.name || !editingSquad.project_id) return toast.error("Nome obrigatório");
    const payload = {
      project_id: editingSquad.project_id,
      name: editingSquad.name,
      description: editingSquad.description ?? null,
    };
    const { error } = editingSquad.id
      ? await supabase.from("squads").update({ name: payload.name, description: payload.description }).eq("id", editingSquad.id)
      : await supabase.from("squads").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Squad salvo");
    setEditingSquad(null);
    refreshAll();
  };

  const removeSquad = async (s: Squad) => {
    if (!confirm(`Excluir squad "${s.name}"?`)) return;
    const { error } = await supabase.from("squads").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Squad removido");
    refreshAll();
  };

  const addMember = async () => {
    if (!managingSquad || !newMemberId) return;
    if (!isSuperAdmin) return toast.error("Apenas SUPER ADMIN adiciona membros.");
    if (usersAlreadyInProject.has(newMemberId)) {
      return toast.error("Usuário já participa de outro squad deste projeto.");
    }
    const { error } = await supabase.from("squad_members").insert({
      squad_id: managingSquad.id, user_id: newMemberId, role_in_squad: newMemberRole,
    });
    if (error) {
      const msg = error.message.includes("outro squad")
        ? "Usuário já participa de outro squad deste projeto."
        : error.message;
      return toast.error(msg);
    }
    setNewMemberId("");
    setNewMemberRole("MEMBRO");
    setMemberSearch("");
    qc.invalidateQueries({ queryKey: ["squad-members", managingSquad.id] });
    qc.invalidateQueries({ queryKey: ["project-memberships"] });
  };

  const removeMember = async (m: SquadMember) => {
    if (!isSuperAdmin) return toast.error("Apenas SUPER ADMIN remove membros.");
    const { error } = await supabase.from("squad_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["squad-members", managingSquad!.id] });
  };

  const toggleLeader = async (m: SquadMember) => {
    if (!isSuperAdmin) return toast.error("Apenas SUPER ADMIN altera líderes.");
    const next = m.role_in_squad === "LIDER" ? "MEMBRO" : "LIDER";
    const { error } = await supabase.from("squad_members").update({ role_in_squad: next }).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["squad-members", managingSquad!.id] });
  };

  return (
    <DashboardShell title="Projetos / Squads" description="Cada projeto pode ter vários squads. Squads têm líderes e membros.">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{projects.length} projeto(s)</p>
        <Button onClick={() => setEditing({ name: "", slug: "", description: "", status: "ativo" })}>
          <Plus className="h-4 w-4 mr-1" /> Novo projeto
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}

      <div className="space-y-4">
        {projects.map((p) => {
          const squads = squadsByProject.get(p.id) ?? [];
          return (
            <div key={p.id} className="glass rounded-xl p-5 border border-primary/20">
              {p.cover_url && (
                <img src={p.cover_url} alt="" className="w-full h-32 object-cover rounded-md mb-3 border border-border/40" />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                    {p.is_public && (
                      <Badge variant="outline" className="text-[10px] border-secondary text-secondary">
                        <Globe className="h-3 w-3 mr-1" /> público
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  {p.is_public && (
                    <a href={`/projetos/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-secondary hover:underline mt-1">
                      Ver página pública <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {p.description && <p className="text-sm text-muted-foreground mt-2">{p.description}</p>}
                  {p.tech_stack && p.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.tech_stack.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3 w-3" /></Button>
                  {isSuperAdmin && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeProject(p)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> SQUADS ({squads.length})
                  </div>
                  {isSuperAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setEditingSquad({ project_id: p.id, name: "", description: "" })}>
                      <Plus className="h-3 w-3 mr-1" /> Novo squad
                    </Button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {squads.map((s) => (
                    <div key={s.id} className="rounded-md border border-border/40 p-3 bg-muted/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{s.name}</div>
                          {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                        </div>
                        {isSuperAdmin && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => setEditingSquad(s)}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeSquad(s)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setManagingSquad(s)}>
                        <UsersIcon className="h-3 w-3 mr-1" /> Membros
                      </Button>
                    </div>
                  ))}
                  {squads.length === 0 && <p className="text-xs text-muted-foreground col-span-2">Nenhum squad neste projeto ainda.</p>}
                </div>
              </div>
            </div>
          );
        })}
        {!isLoading && projects.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum projeto criado ainda.</p>
        )}
      </div>

      {/* Project edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar projeto" : "Novo projeto"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div><Label>Nome</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value, slug: editing?.slug || slugify(e.target.value) })} /></div>
            <div><Label>Slug</Label><Input value={editing?.slug ?? ""} onChange={(e) => setEditing({ ...editing!, slug: slugify(e.target.value) })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} /></div>
            <ImageUploader
              bucket="project-covers"
              folder={editing?.id ?? "novo"}
              value={editing?.cover_url ?? null}
              onChange={(url) => setEditing({ ...editing!, cover_url: url })}
              label="Capa do projeto"
              aspect="video"
            />
            <ImageUploader
              bucket="project-covers"
              folder={`${editing?.id ?? "novo"}/banner`}
              value={editing?.banner_url ?? null}
              onChange={(url) => setEditing({ ...editing!, banner_url: url })}
              label="Banner do projeto (hero da página pública)"
              aspect="video"
            />
            <p className="text-[10px] text-muted-foreground -mt-1">
              Imagem em destaque no topo da página /projetos/{editing?.slug || "slug"}. Recomendado: 1920×600.
            </p>
            <div>
              <Label>Tech stack</Label>
              <Input
                placeholder="Digite e pressione Enter"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const t = techInput.trim();
                    const cur = editing?.tech_stack ?? [];
                    if (t && !cur.includes(t) && cur.length < 20) {
                      setEditing({ ...editing!, tech_stack: [...cur, t] });
                    }
                    setTechInput("");
                  }
                }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(editing?.tech_stack ?? []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                    {t}
                    <button type="button" onClick={() => setEditing({ ...editing!, tech_stack: (editing?.tech_stack ?? []).filter((x) => x !== t) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editing?.status ?? "ativo"} onValueChange={(v) => setEditing({ ...editing!, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border border-border/40 bg-muted/20">
              <Switch checked={!!editing?.is_public} onCheckedChange={(v) => setEditing({ ...editing!, is_public: v })} />
              <div>
                <Label className="!mt-0 flex items-center gap-1"><Globe className="h-3 w-3" /> Página pública</Label>
                <p className="text-[10px] text-muted-foreground">Cria página em /projetos/{editing?.slug || "slug"} visível para qualquer pessoa.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveProject}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Squad edit dialog */}
      <Dialog open={!!editingSquad} onOpenChange={(o) => !o && setEditingSquad(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingSquad?.id ? "Editar squad" : "Novo squad"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome do squad</Label><Input value={editingSquad?.name ?? ""} onChange={(e) => setEditingSquad({ ...editingSquad!, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={editingSquad?.description ?? ""} onChange={(e) => setEditingSquad({ ...editingSquad!, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingSquad(null)}>Cancelar</Button>
            <Button onClick={saveSquad}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Squad members dialog */}
      <Dialog open={!!managingSquad} onOpenChange={(o) => !o && setManagingSquad(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Membros — {managingSquad?.name}</DialogTitle>
            <DialogDescription>
              {isSuperAdmin ? "SUPER ADMIN gerencia membros e líderes do squad. Pode haver vários líderes." : "Apenas SUPER ADMIN pode gerenciar membros."}
            </DialogDescription>
          </DialogHeader>

          {isSuperAdmin && (
            <div className="flex gap-2 items-end pb-3 border-b border-border/40">
              <div className="flex-1">
                <Label>Adicionar usuário</Label>
                <Select value={newMemberId} onValueChange={setNewMemberId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {profiles
                      .filter((p) => !squadMembers.some((m) => m.user_id === p.user_id))
                      .map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.display_name} — {p.email}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-36">
                <Label>Papel</Label>
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBRO">Membro</SelectItem>
                    <SelectItem value="LIDER">Líder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addMember} disabled={!newMemberId}>Adicionar</Button>
            </div>
          )}

          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {squadMembers.map((m) => {
              const p = profileById.get(m.user_id);
              return (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    {m.role_in_squad === "LIDER" && <Crown className="h-3 w-3 text-secondary" />}
                    <span className="text-sm">{p?.display_name ?? m.user_id}</span>
                    <span className="text-xs text-muted-foreground">{p?.email}</span>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleLeader(m)}>
                        {m.role_in_squad === "LIDER" ? "Remover líder" : "Tornar líder"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeMember(m)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {squadMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro ainda.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}