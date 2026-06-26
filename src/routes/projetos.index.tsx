import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FolderKanban, ArrowRight, Globe } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/projetos/")({
  head: () => ({
    meta: [
      { title: "Projetos públicos — GALERA DO T.I." },
      { name: "description", content: "Conheça os projetos abertos da comunidade GALERA DO T.I., seus squads e tecnologias." },
      { property: "og:title", content: "Projetos públicos — GALERA DO T.I." },
      { property: "og:description", content: "Conheça os projetos abertos da comunidade GALERA DO T.I." },
    ],
  }),
  component: ProjetosIndex,
});

type PublicProject = { id: string; name: string; slug: string; description: string | null; cover_url: string | null; tech_stack: string[]; status: string };
type SquadLite = { id: string; project_id: string; recruiting_status: "open" | "closed" | "waitlist" };

function ProjetosIndex() {
  const [q, setQ] = useState("");
  const [tech, setTech] = useState("all");
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["public-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,slug,description,cover_url,tech_stack,status")
        .eq("is_public", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PublicProject[];
    },
  });

  const { data: squads = [] } = useQuery({
    queryKey: ["public-projects-squads", projects.map((p) => p.id).join(",")],
    enabled: projects.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squads")
        .select("id,project_id,recruiting_status")
        .in("project_id", projects.map((p) => p.id));
      if (error) throw error;
      return (data ?? []) as SquadLite[];
    },
  });
  const recruitingByProject = useMemo(() => {
    const m = new Map<string, "open" | "waitlist" | "closed">();
    squads.forEach((s) => {
      const cur = m.get(s.project_id);
      if (s.recruiting_status === "open") m.set(s.project_id, "open");
      else if (s.recruiting_status === "waitlist" && cur !== "open") m.set(s.project_id, "waitlist");
      else if (!cur) m.set(s.project_id, "closed");
    });
    return m;
  }, [squads]);

  const techOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => (p.tech_stack ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [projects]);

  const filtered = projects.filter((p) => {
    const t = q.toLowerCase();
    const matchSearch = !t || p.name.toLowerCase().includes(t) || (p.description ?? "").toLowerCase().includes(t);
    const matchTech = tech === "all" || (p.tech_stack ?? []).includes(tech);
    return matchSearch && matchTech;
  });

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-[1fr_220px] gap-8 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2 flex items-center gap-2">
              <Globe className="h-3 w-3" /> COMUNIDADE
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">Projetos da galera</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Iniciativas abertas mantidas por squads da comunidade. Veja quem está construindo o quê e quais tecnologias estão sendo usadas.
            </p>
          </div>
          <PublicMascotSpot placement="projects" className="hidden lg:flex" />
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-2 max-w-3xl">
          <Input className="md:col-span-2" placeholder="Buscar projeto..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={tech} onValueChange={setTech}>
            <SelectTrigger><SelectValue placeholder="Tecnologia" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todas tecnologias</SelectItem>
              {techOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} projeto(s)</p>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 glass rounded-xl p-10 text-center">
            <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-3">Nenhum projeto público no momento. Volte em breve.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to="/projetos/$slug"
                params={{ slug: p.slug }}
                className="group glass rounded-xl overflow-hidden border border-primary/20 hover:border-primary/50 transition flex flex-col animate-in fade-in"
              >
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderKanban className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <RecruitingBadge status={recruitingByProject.get(p.id) ?? "closed"} />
                  </div>
                  <div className="text-[10px] tracking-widest text-muted-foreground/70 mt-1">{labelStatus(p.status)}</div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">{p.description}</p>
                  )}
                  {p.tech_stack && p.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {p.tech_stack.slice(0, 5).map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{t}</span>
                      ))}
                      {p.tech_stack.length > 5 && (
                        <span className="text-[10px] px-2 py-0.5 text-muted-foreground">+{p.tech_stack.length - 5}</span>
                      )}
                    </div>
                  )}
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold tracking-widest text-primary group-hover:gap-2 transition-all">
                    VER PROJETO <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

function labelStatus(s: string) {
  return s === "em_andamento" ? "EM ANDAMENTO" : s === "concluido" ? "CONCLUÍDO" : s === "pausado" ? "PAUSADO" : s.toUpperCase();
}
function RecruitingBadge({ status }: { status: "open" | "closed" | "waitlist" }) {
  if (status === "open") return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">VAGAS ABERTAS</span>;
  if (status === "waitlist") return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">LISTA DE ESPERA</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40 shrink-0">FECHADO</span>;
}