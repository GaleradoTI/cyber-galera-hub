import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PublicLayout } from "@/components/public/public-layout";
import { JobCard } from "@/components/public/job-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogIn, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobDetailDialog } from "@/components/public/job-detail-dialog";

export const Route = createFileRoute("/vagas")({
  head: () => ({
    meta: [
      { title: "Vagas — GALERA DO T.I." },
      { name: "description", content: "Oportunidades de trabalho em tecnologia curadas pela comunidade." },
    ],
  }),
  component: VagasPage,
});

function VagasPage() {
  const [q, setQ] = useState("");
  const [modality, setModality] = useState<string>("all");
  const [seniority, setSeniority] = useState<string>("all");
  const [tech, setTech] = useState<string>("all");
  const [location, setLocation] = useState<string>("");
  const [selected, setSelected] = useState<any | null>(null);
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "publicado")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const techOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j: any) => (j.technologies ?? []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [jobs]);

  const filtered = jobs.filter((j: any) => {
    const t = q.toLowerCase();
    const matchSearch =
      !t ||
      j.title?.toLowerCase().includes(t) ||
      j.company?.toLowerCase().includes(t) ||
      (j.technologies ?? []).some((tech: string) => tech.toLowerCase().includes(t));
    const matchModality = modality === "all" || j.modality === modality;
    const matchSeniority = seniority === "all" || j.seniority === seniority;
    const matchTech = tech === "all" || (j.technologies ?? []).includes(tech);
    const matchLocation = !location || (j.location ?? "").toLowerCase().includes(location.toLowerCase());
    return matchSearch && matchModality && matchSeniority && matchTech && matchLocation;
  });

  const activeFilters = [modality !== "all", seniority !== "all", tech !== "all", !!location].filter(Boolean).length;
  const clearFilters = () => { setModality("all"); setSeniority("all"); setTech("all"); setLocation(""); };

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">OPORTUNIDADES</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Vagas tech</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">Vagas publicadas pela equipe da comunidade.</p>
          </div>
          <Button asChild variant="neon-outline" size="sm">
            <Link to="/login"><LogIn className="h-3.5 w-3.5 mr-1.5" /> Área do recrutador</Link>
          </Button>
        </div>

        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-5 gap-2">
          <Input className="lg:col-span-2" placeholder="Buscar por cargo, empresa ou tecnologia..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger><SelectValue placeholder="Modalidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas modalidades</SelectItem>
              <SelectItem value="remoto">Remoto</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={seniority} onValueChange={setSeniority}>
            <SelectTrigger><SelectValue placeholder="Senioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas senioridades</SelectItem>
              <SelectItem value="estagio">Estágio</SelectItem>
              <SelectItem value="junior">Júnior</SelectItem>
              <SelectItem value="pleno">Pleno</SelectItem>
              <SelectItem value="senior">Sênior</SelectItem>
              <SelectItem value="especialista">Especialista</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tech} onValueChange={setTech}>
            <SelectTrigger><SelectValue placeholder="Tecnologia" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todas tecnologias</SelectItem>
              {techOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="lg:col-span-2" placeholder="Localização (cidade, estado)" value={location} onChange={(e) => setLocation(e.target.value)} />
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-self-start">
              <X className="h-3 w-3 mr-1" /> Limpar filtros ({activeFilters})
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} vaga(s) encontrada(s)</p>

        {isLoading ? (
          <p className="text-muted-foreground mt-10">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground mt-10">Nenhuma vaga encontrada.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {filtered.map((j: any) => <JobCard key={j.id} job={j} onClick={() => setSelected(j)} />)}
          </div>
        )}
        <JobDetailDialog job={selected} open={!!selected} onOpenChange={(v) => !v && setSelected(null)} />
      </section>
    </PublicLayout>
  );
}