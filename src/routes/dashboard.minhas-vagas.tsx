import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/minhas-vagas")({ component: MinhasVagasPage });

function MinhasVagasPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["my-saved-jobs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_jobs")
        .select("id, created_at, jobs(id, title, company, location, modality, seniority, apply_url, status)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("saved_jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Vaga removida");
    qc.invalidateQueries({ queryKey: ["my-saved-jobs"] });
    qc.invalidateQueries({ queryKey: ["saved-jobs-count"] });
  };

  return (
    <DashboardShell title="Vagas Salvas" description="Sua coleção pessoal de oportunidades.">
      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      {!isLoading && data.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <Heart className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Você ainda não salvou nenhuma vaga.</p>
          <Link to="/vagas" className="inline-block mt-4">
            <Button>Ver vagas disponíveis</Button>
          </Link>
        </div>
      )}
      <div className="grid gap-3">
        {data.map((row: any) => {
          const j = row.jobs;
          if (!j) return null;
          return (
            <div key={row.id} className="glass rounded-xl p-4 border border-primary/20 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{j.title}</div>
                <div className="text-xs text-muted-foreground">{j.company} • {j.location ?? "Remoto"} • {j.modality} • {j.seniority}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {j.apply_url && (
                  <a href={j.apply_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1" /> Aplicar</Button>
                  </a>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(row.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}