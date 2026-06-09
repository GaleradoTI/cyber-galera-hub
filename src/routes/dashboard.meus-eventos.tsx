import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ExternalLink, Trash2, CheckCircle2, MapPin } from "lucide-react";
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
        .select("id, created_at, events(id, name, description, event_date, event_time, modality, location_or_link, online_link, address, theme, category, status)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ["my-checkins", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("event_checkins").select("event_id").eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.event_id);
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-events"] });
    qc.invalidateQueries({ queryKey: ["my-checkins"] });
    qc.invalidateQueries({ queryKey: ["interests-count"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_event_interests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Inscrição removida");
    refresh();
  };

  const toggleCheckin = async (eventId: string, isCheckedIn: boolean) => {
    if (!user) return;
    if (isCheckedIn) {
      const { error } = await supabase.from("event_checkins").delete().eq("user_id", user.id).eq("event_id", eventId);
      if (error) return toast.error(error.message);
      toast.success("Check-in cancelado");
    } else {
      const { error } = await supabase.from("event_checkins").insert({ user_id: user.id, event_id: eventId });
      if (error) return toast.error(error.message);
      toast.success("Check-in confirmado!");
    }
    refresh();
  };

  return (
    <DashboardShell title="Meus Eventos" description="Eventos em que você demonstrou interesse.">
      {(!user || isLoading) && <div className="text-muted-foreground">Carregando…</div>}
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
          const link = e.online_link || (e.location_or_link?.startsWith("http") ? e.location_or_link : null);
          const place = e.address || (!e.location_or_link?.startsWith("http") ? e.location_or_link : null);
          const checked = checkins.includes(e.id);
          return (
            <div key={row.id} className="glass rounded-xl p-4 border border-primary/20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{e.name}</div>
                {e.theme && <div className="text-xs text-primary mt-0.5">{e.theme}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(e.event_date).toLocaleDateString("pt-BR")}
                  {e.event_time ? ` • ${e.event_time}` : ""} • {e.modality}
                </div>
                {place && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {place}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1" /> Acessar</Button>
                  </a>
                )}
                <Button size="sm" variant={checked ? "default" : "neon"} onClick={() => toggleCheckin(e.id, checked)}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {checked ? "Check-in feito" : "Fazer check-in"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(row.id)} title="Cancelar inscrição">
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