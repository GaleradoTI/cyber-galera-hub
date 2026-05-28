import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users as UsersIcon, Crown } from "lucide-react";
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

export const Route = createFileRoute("/dashboard/projetos")({ component: ProjetosAdminPage });

type Project = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; status: string; created_at: string };
type Member = { id: string; project_id: string; user_id: string; role_in_project: string };
type Profile = { user_id: string; display_name: string; email: string };

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 60);

function ProjetosAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [managing, setManaging] = useState<Project | null>(null);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("MEMBRO");

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
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

  const { data: members = [] } = useQuery({
    queryKey: ["project-members", managing?.id],
    enabled: !!managing?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("*").eq("project_id", managing!.id);
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-projects"] });
    qc.invalidateQueries({ queryKey: ["project-members"] });
    qc.invalidateQueries({ queryKey: ["my-projects"] });
  };

  const saveProject = async () => {
    if (!editing?.name) return toast.error("Nome obrigatório");
    const payload = {
      name: editing.name!,
      slug: editing.slug || slugify(editing.name!),
      description: editing.description ?? null,
      cover_url: editing.cover_url ?? null,
      status: editing.status ?? "ativo",
    };
    if (editing.id) {
      const { error } = await supabase.from("projects").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("projects").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Projeto salvo");
    setEditing(null);
    refresh();
  };

  const removeProject = async (p: Project) => {
    if (!confirm(`Excluir projeto "${p.name}"?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Projeto removido");
    refresh();
  };

  const addMember = async () => {
    if (!managing || !newMemberId) return;
    if (!isSuperAdmin) return toast.error("Apenas SUPER ADMIN adiciona membros.");
    const { error } = await supabase.from("project_members").insert({
      project_id: managing.id, user_id: newMemberId, role_in_project: newMemberRole,
    });
    if (error) return toast.error(error.message);
    setNewMemberId("");
    setNewMemberRole("MEMBRO");
    qc.invalidateQueries({ queryKey: ["project-members", managing.id] });
  };

  const removeMember = async (m: Member) => {
    if (!isSuperAdmin) return toast.error("Apenas SUPER ADMIN remove membros.");
    const { error } = await supabase.from("project_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["project-members", managing!.id] });
  };

  const toggleLeader = async (m: Member) => {
    if (!isSuperAdmin) return toast.error("Apenas SUPER ADMIN altera líderes.");
    const next = m.role_in_project === "LIDER" ? "MEMBRO" : "LIDER";
    const { error } = await supabase.from("project_members").update({ role_in_project: next }).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["project-members", managing!.id] });
  };

  return (
    <DashboardShell title="Projetos / Squads" description="Crie projetos e atribua membros e líderes.">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{projects.length} projeto(s)</p>
        <Button onClick={() => setEditing({ name: "", slug: "", description: "", status: "ativo" })}>
          <Plus className="h-4 w-4 mr-1" /> Novo projeto
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
        {projects.map((p) => (
          <div key={p.id} className="glass rounded-xl p-5 border border-primary/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{p.name}</h3>
                <p className="text-xs text-muted-foreground">/{p.slug}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
            </div>
            {p.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>}
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => setManaging(p)}>
                <UsersIcon className="h-3 w-3 mr-1" /> Membros
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
              {isSuperAdmin && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeProject(p)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && projects.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">Nenhum projeto criado ainda.</p>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar projeto" : "Novo projeto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value, slug: editing?.slug || slugify(e.target.value) })} /></div>
            <div><Label>Slug</Label><Input value={editing?.slug ?? ""} onChange={(e) => setEditing({ ...editing!, slug: slugify(e.target.value) })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} /></div>
            <div><Label>URL da capa</Label><Input value={editing?.cover_url ?? ""} onChange={(e) => setEditing({ ...editing!, cover_url: e.target.value })} /></div>
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveProject}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={!!managing} onOpenChange={(o) => !o && setManaging(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Membros — {managing?.name}</DialogTitle>
            <DialogDescription>
              {isSuperAdmin ? "Como SUPER ADMIN você pode adicionar/remover membros e definir líderes." : "Apenas SUPER ADMIN pode gerenciar membros."}
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
                      .filter((p) => !members.some((m) => m.user_id === p.user_id))
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
            {members.map((m) => {
              const p = profileById.get(m.user_id);
              return (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    {m.role_in_project === "LIDER" && <Crown className="h-3 w-3 text-secondary" />}
                    <span className="text-sm">{p?.display_name ?? m.user_id}</span>
                    <span className="text-xs text-muted-foreground">{p?.email}</span>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleLeader(m)}>
                        {m.role_in_project === "LIDER" ? "Remover líder" : "Tornar líder"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeMember(m)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro ainda.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}