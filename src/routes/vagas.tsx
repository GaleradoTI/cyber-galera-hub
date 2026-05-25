import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout } from "@/components/public/public-layout";
import { JobCard } from "@/components/public/job-card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

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

  const filtered = jobs.filter((j: any) => {
    const t = q.toLowerCase();
    return !t || j.title?.toLowerCase().includes(t) || j.company?.toLowerCase().includes(t) ||
      (j.technologies ?? []).some((tech: string) => tech.toLowerCase().includes(t));
  });

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">OPORTUNIDADES</div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Vagas tech</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">Vagas publicadas pela equipe da comunidade.</p>

        <div className="mt-8 max-w-md">
          <Input placeholder="Buscar por cargo, empresa ou tecnologia..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground mt-10">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground mt-10">Nenhuma vaga encontrada.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {filtered.map((j: any) => <JobCard key={j.id} job={j} />)}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}