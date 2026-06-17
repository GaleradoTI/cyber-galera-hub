import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, FolderKanban, UserPlus, Layers, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/explorar-projetos")({ component: ExplorarProjetosPage });

type Project = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; status: string; tech_stack: string[] | null };
type Squad = { id: string; project_id: string; name: string; description: string | null; recruiting_status: "open" | "closed" | "waitlist" };
type SquadMember = { id: string; squad_id: string; user_id: string };
type JoinReq = { id: string; squad_id: string | null; project_id: string; status: string };

function ExplorarProjetosPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [joinSquad, setJoinSquad] = useState<{ squad: Squad; project: Project } | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["explorar-projetos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const { data: squads = [] } = useQuery({
    queryKey: ["explorar-squads", projects.map((p) => p.id).join(",")],
    enabled: projects.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("squads").select("*").in("project_id", projects.map((p) => p.id));
      if (error) throw error;
      return (data ?? []) as Squad[];
    },
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ["my-memberships-min", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("squad_members").select("id,squad_id,user_id").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as SquadMember[];
    },
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-join-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_join_requests").select("id,squad_id,project_id,status").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as JoinReq[];
    },
  });

  const squadsByProject = useMemo(() => {
    const m = new Map<string, Squad[]>();
    squads.forEach((s) => { const a = m.get(s.project_id) ?? []; a.push(s); m.set(s.project_id, a); });
    return m;
  }, [squads]);

  const isMemberOfSquad = (squadId: string) => myMemberships.some((m) => m.squad_id === squadId);
  const hasActiveRequest = (squadId: string) =>
    myRequests.some((r) => r.squad_id === squadId && (r.status === "pending" || r.status === "waitlist"));

  const filtered = projects.filter((p) => {
    const t = q.toLowerCase();
    if (!t) return true;
    return p.name.toLowerCase().includes(t)
      || (p.description ?? "").toLowerCase().includes(t)
      || (p.tech_stack ?? []).some((x) => x.toLowerCase().includes(t));
  });

  const submit = async () => {
    if (!user || !joinSquad) return;
    setSending(true);
    const status = joinSquad.squad.recruiting_status === "waitlist" ? "waitlist" : "pending";
    const { error } = await supabase.from("project_join_requests").insert({
      project_id: joinSquad.project.id,
      squad_id: joinSquad.squad.id,
      user_id: user.id,
      message: joinMessage.trim() || null,
      status,
      source: "dashboard",
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(status === "waitlist" ? "Você entrou na lista de espera" : "Solicitação enviada — o líder do squad vai avaliar.");
    setJoinSquad(null);
    setJoinMessage("");
    qc.invalidateQueries({ queryKey: ["my-join-requests"] });
  };

  return (
    <DashboardShell
      title="Explorar Projetos"
      description="Veja todos os projetos da comunidade e solicite entrada em squads com vagas abertas."
    >
      <div className="glass rounded-xl border border-primary/20 p-3 mb-4 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, descrição ou tecnologia…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-0 bg-transparent focus-visible:ring-0"
        />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">
          <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Nenhum projeto encontrado.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const ps = squadsByProject.get(p.id) ?? [];
            return (
              <div key={p.id} className="glass rounded-xl border border-primary/20 p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold tracking-widest text-secondary mb-1 flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {labelStatus(p.status)}
                    </div>
                    <h3 className="font-bold text-lg truncate">{p.name}</h3>
                  </div>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>}
                {p.tech_stack && p.tech_stack.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.tech_stack.slice(0, 6).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
                  <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> SQUADS ({ps.length})
                  </div>
                  {ps.length === 0 && <p className="text-xs text-muted-foreground">Sem squads cadastrados.</p>}
                  {ps.map((s) => {
                    const member = isMemberOfSquad(s.id);
                    const requested = hasActiveRequest(s.id);
                    const closed = s.recruiting_status === "closed";
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{s.name}</span>
                          <RecruitingBadge status={s.recruiting_status} />
                        </div>
                        {member ? (
                          <Badge variant="outline" className="text-[10px] shrink-0">Você participa</Badge>
                        ) : requested ? (
                          <Badge className="text-[10px] shrink-0" variant="secondary">Solicitado</Badge>
                        ) : (
                          <Button
                            size="sm" variant={closed ? "ghost" : "outline"}
                            disabled={closed}
                            onClick={() => { setJoinSquad({ squad: s, project: p }); setJoinMessage(""); }}
                            className="shrink-0"
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            {s.recruiting_status === "waitlist" ? "Entrar na espera" : closed ? "Fechado" : "Solicitar"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!joinSquad} onOpenChange={(o) => !o && setJoinSquad(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar entrada — {joinSquad?.squad.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Projeto: <strong>{joinSquad?.project.name}</strong>.{" "}
            {joinSquad?.squad.recruiting_status === "waitlist"
              ? "Este squad está sem vagas — você entrará na lista de espera."
              : "O líder do squad vai analisar sua solicitação."}
          </p>
          <Textarea
            rows={4}
            placeholder="Conte por que você quer participar (opcional)…"
            value={joinMessage}
            onChange={(e) => setJoinMessage(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJoinSquad(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={sending}>{sending ? "Enviando…" : "Enviar solicitação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function labelStatus(s: string) {
  return s === "em_andamento" ? "EM ANDAMENTO" : s === "concluido" ? "CONCLUÍDO" : s === "pausado" ? "PAUSADO" : s.toUpperCase();
}
function RecruitingBadge({ status }: { status: "open" | "closed" | "waitlist" }) {
  if (status === "open") return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">ABERTO</span>;
  if (status === "waitlist") return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">ESPERA</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40">FECHADO</span>;
}