import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout } from "@/components/public/public-layout";
import { EventCard } from "@/components/public/event-card";
import { supabase } from "@/integrations/supabase/client";
import { EventDetailDialog } from "@/components/public/event-detail-dialog";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — GALERA DO T.I." },
      { name: "description", content: "Meetups, workshops e lives da comunidade tech." },
    ],
  }),
  component: EventosPage,
});

function EventosPage() {
  const [selected, setSelected] = useState<any | null>(null);
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("status", "publicado")
        .order("event_date", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">AGENDA</div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Próximos eventos</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">Encontros, lives e workshops abertos para a comunidade.</p>

        {isLoading ? (
          <p className="text-muted-foreground mt-10">Carregando...</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground mt-10">Nenhum evento publicado.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {events.map((e: any) => <EventCard key={e.id} event={e} onClick={() => setSelected(e)} />)}
          </div>
        )}
        <EventDetailDialog event={selected} open={!!selected} onOpenChange={(v) => !v && setSelected(null)} />
      </section>
    </PublicLayout>
  );
}