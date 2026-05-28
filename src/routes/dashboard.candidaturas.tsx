import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/candidaturas")({ component: CandidaturasPage });

type App = { id: string; job_id: string; status: string; created_at: string };
type Job = { id: string; title: string; company: string; location: string | null; apply_url: string | null; modality: string; seniority: string };

const STATUS_LABEL: Record<string, string> = {
  enviada: "Enviada",
  em_analise: "Em análise",
  contratado: "Contratado",
  rejeitada: "Rejeitada",
};

function CandidaturasPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["my-applications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as App[];
    },
  });

  const jobIds = useMemo(() => apps.map((a) => a.job_id), [apps]);

  const { data: jobs = [] } = useQuery({
    queryKey: ["my-application-jobs", jobIds.join(",")],
    enabled: jobIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("id,title,company,location,apply_url,modality,seniority").in("id", jobIds);
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const cancel = async (id: string) => {
    if (!confirm("Cancelar esta candidatura?")) return;
    const { error } = await supabase.from("job_applications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Candidatura removida");
    qc.invalidateQueries({ queryKey: ["my-applications"] });
  };

  return (
    <DashboardShell title="Minhas Candidaturas" description="Histórico das vagas para as quais você se candidatou.">
      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
      {!isLoading && apps.length === 0 && (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">
          Você ainda não se candidatou a nenhuma vaga.
        </div>
      )}
      <div className="space-y-3">
        {apps.map((a) => {
          const j = jobById.get(a.job_id);
          return (
            <div key={a.id} className="glass rounded-xl p-4 border border-primary/20 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Briefcase className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold truncate">{j?.title ?? "Vaga removida"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {j?.company}{j?.location ? ` • ${j.location}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                    {j?.modality && <Badge variant="outline" className="text-[10px]">{j.modality}</Badge>}
                    {j?.seniority && <Badge variant="outline" className="text-[10px]">{j.seniority}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {j?.apply_url && (
                  <a href={j.apply_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3" /></Button>
                  </a>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancel(a.id)}><X className="h-3 w-3" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}