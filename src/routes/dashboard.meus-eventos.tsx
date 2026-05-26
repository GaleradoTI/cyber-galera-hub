import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/meus-eventos")({ component: MeusEventosPage });

function MeusEventosPage() {
  const { user } = useDashboardRoles();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["my-events", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_event_interests")
        .select("id, created_at, events(id, name, description, event_date, event_time, modality, location_or_link, category, status)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_event_interests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Inscrição removida");
    qc.invalidateQueries({ queryKey: ["my-events"] });
    qc.invalidateQueries({ queryKey: ["interests-count"] });
  };

  return (
    <DashboardShell title="Meus Eventos" description="Eventos em que você demonstrou interesse.">
      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      {!isLoading && data.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Você ainda não se inscreveu em nenhum evento.</p>
          <Link to="/eventos" className="inline-block mt-4">
            <Button>Ver próximos eventos</Button>
          </Link>
        </div>
      )}
      <div className="grid gap-3">
        {data.map((row: any) => {
          const e = row.events;
          if (!e) return null;
          return (
            <div key={row.id} className="glass rounded-xl p-4 border border-primary/20 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{e.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.event_date).toLocaleDateString("pt-BR")}
                  {e.event_time ? ` • ${e.event_time}` : ""} • {e.modality}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {e.location_or_link && e.location_or_link.startsWith("http") && (
                  <a href={e.location_or_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1" /> Acessar</Button>
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