import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Pencil, Users as UsersIcon } from "lucide-react";
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
type Member = { project_id: string; user_id: string; role_in_project: string };
type Profile = { user_id: string; display_name: string; email: string };

function MeusProjetosPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Project | null>(null);

  const { data: myMembership = [] } = useQuery({
    queryKey: ["my-project-membership", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("project_id,user_id,role_in_project").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const projectIds = useMemo(() => myMembership.map((m) => m.project_id), [myMembership]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["my-projects", projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").in("id", projectIds);
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["my-projects-members", projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("project_id,user_id,role_in_project").in("project_id", projectIds);
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(allMembers.map((m) => m.user_id))), [allMembers]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["my-projects-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,display_name,email").in("user_id", userIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);
  const membersByProject = useMemo(() => {
    const m = new Map<string, Member[]>();
    allMembers.forEach((x) => {
      const arr = m.get(x.project_id) ?? [];
      arr.push(x);
      m.set(x.project_id, arr);
    });
    return m;
  }, [allMembers]);

  const isLeader = (projectId: string) =>
    myMembership.some((m) => m.project_id === projectId && m.role_in_project === "LIDER");

  const saveProject = async () => {
    if (!editing) return;
    const { error } = await supabase.from("projects").update({
      name: editing.name,
      description: editing.description,
      cover_url: editing.cover_url,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Projeto atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["my-projects"] });
  };

  return (
    <DashboardShell title="Meus Projetos" description="Squads dos quais você participa.">
      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
      {!isLoading && projects.length === 0 && (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">
          Você ainda não foi adicionado a nenhum projeto. O SUPER ADMIN pode incluir você em squads.
        </div>
      )}
      <div className="space-y-4">
        {projects.map((p) => {
          const ms = membersByProject.get(p.id) ?? [];
          const leader = isLeader(p.id);
          return (
            <div key={p.id} className="glass rounded-xl p-6 border border-primary/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    {leader && <Badge variant="outline" className="border-secondary text-secondary text-[10px]"><Crown className="h-3 w-3 mr-1" /> Líder</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.status}</p>
                </div>
                {leader && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                )}
              </div>
              {p.description && <p className="text-sm text-muted-foreground mt-3">{p.description}</p>}
              <div className="mt-4">
                <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 mb-2 flex items-center gap-1">
                  <UsersIcon className="h-3 w-3" /> SQUAD ({ms.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {ms.map((m) => {
                    const u = profileById.get(m.user_id);
                    return (
                      <div key={m.user_id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 text-xs">
                        {m.role_in_project === "LIDER" && <Crown className="h-3 w-3 text-secondary" />}
                        <span>{u?.display_name ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar projeto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={4} value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} /></div>
            <div><Label>URL da capa</Label><Input value={editing?.cover_url ?? ""} onChange={(e) => setEditing({ ...editing!, cover_url: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveProject}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}