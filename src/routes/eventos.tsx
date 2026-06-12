import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PublicLayout } from "@/components/public/public-layout";
import { EventCard } from "@/components/public/event-card";
import { supabase } from "@/integrations/supabase/client";
import { EventDetailDialog } from "@/components/public/event-detail-dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
  const { isAuthenticated } = useAuth();
  const [selected, setSelected] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [modality, setModality] = useState("all");
  const [category, setCategory] = useState("all");
  const [when, setWhen] = useState("upcoming");
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

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e: any) => e.category && set.add(e.category));
    return Array.from(set).sort();
  }, [events]);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = events.filter((e: any) => {
    const t = q.toLowerCase();
    const matchSearch = !t || e.name?.toLowerCase().includes(t) || e.description?.toLowerCase().includes(t);
    const matchModality = modality === "all" || e.modality === modality;
    const matchCategory = category === "all" || e.category === category;
    const matchWhen =
      when === "all" ||
      (when === "upcoming" && e.event_date >= today) ||
      (when === "past" && e.event_date < today);
    return matchSearch && matchModality && matchCategory && matchWhen;
  });

  const activeFilters = [modality !== "all", category !== "all", when !== "upcoming"].filter(Boolean).length;
  const clearFilters = () => { setModality("all"); setCategory("all"); setWhen("upcoming"); setQ(""); };

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">AGENDA</div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Próximos eventos</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">Encontros, lives e workshops abertos para a comunidade.</p>

        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input className="md:col-span-2 lg:col-span-1" placeholder="Buscar evento..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger><SelectValue placeholder="Modalidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas modalidades</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={when} onValueChange={setWhen}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Próximos</SelectItem>
              <SelectItem value="past">Passados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs text-muted-foreground">{filtered.length} evento(s)</p>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-3 w-3 mr-1" /> Limpar</Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground mt-10">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground mt-10">Nenhum evento encontrado.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {filtered.map((e: any) => {
              const isThirdAnon = !isAuthenticated && e.source === "terceiros";
              return <EventCard key={e.id} event={e} onClick={isThirdAnon ? undefined : () => setSelected(e)} />;
            })}
          </div>
        )}
        {!isAuthenticated && (
          <div className="mt-10 glass rounded-xl p-5 border border-primary/30 text-sm">
            Para se inscrever em eventos da <strong>comunidade</strong>, você precisa ser membro.{" "}
            <a href="/cadastro" className="text-primary underline">Cadastre-se</a> ou{" "}
            <a href="/login" className="text-primary underline">entre</a>.
          </div>
        )}
        <EventDetailDialog event={selected} open={!!selected} onOpenChange={(v) => !v && setSelected(null)} />
      </section>
    </PublicLayout>
  );
}