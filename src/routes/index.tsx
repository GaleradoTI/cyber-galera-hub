import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Code2, Database, Cloud, Brain, Smartphone, Shield, Server, Infinity as InfinityIcon } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";
import { Hero } from "@/components/public/hero";
import { StatsSection } from "@/components/public/stats-section";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { JobCard } from "@/components/public/job-card";
import { EventCard } from "@/components/public/event-card";
import { ChannelGrid } from "@/components/public/channel-grid";
import { TestimonialsSection } from "@/components/public/testimonials-section";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GALERA DO T.I. — Comunidade Tech, Networking e Carreira" },
      { name: "description", content: "A maior comunidade tech para networking, aprendizado e oportunidades. Se tem código, tem solução." },
      { property: "og:title", content: "GALERA DO T.I." },
      { property: "og:description", content: "Se tem código, tem solução. Se não tem, a gente cria." },
    ],
  }),
  component: Index,
});

const TECH_AREAS = [
  { icon: Code2, label: "Front-end", color: "text-primary" },
  { icon: Server, label: "Back-end", color: "text-secondary" },
  { icon: InfinityIcon, label: "DevOps", color: "text-[oklch(0.88_0.30_145)]" },
  { icon: Database, label: "Data Science", color: "text-[oklch(0.78_0.18_65)]" },
  { icon: Shield, label: "Cyber Security", color: "text-primary" },
  { icon: Smartphone, label: "Mobile", color: "text-secondary" },
  { icon: Cloud, label: "Cloud", color: "text-[oklch(0.88_0.30_145)]" },
  { icon: Brain, label: "AI & ML", color: "text-[oklch(0.78_0.18_65)]" },
];

function Index() {
  const { data: jobs = [] } = useQuery({
    queryKey: ["home-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "publicado")
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["home-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("status", "publicado")
        .order("event_date", { ascending: true })
        .limit(3);
      return data ?? [];
    },
  });

  return (
    <PublicLayout>
      <Hero />
      <StatsSection />

      {/* Áreas & Tecnologias */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow="ECOSSISTEMA"
          title="Áreas & Tecnologias"
          subtitle="A comunidade reúne profissionais de todas as frentes da tecnologia."
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
          {TECH_AREAS.map((area, i) => {
            const Icon = area.icon;
            return (
              <motion.div
                key={area.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-6 flex flex-col items-center gap-3 hover-glow-cyan group cursor-default"
              >
                <Icon className={`h-8 w-8 ${area.color} group-hover:scale-110 transition-transform`} />
                <span className="text-sm font-semibold">{area.label}</span>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Vagas */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow="OPORTUNIDADES"
          title="Últimas vagas"
          subtitle="Vagas curadas e publicadas direto pela equipe."
          cta={{ to: "/vagas", label: "Ver todas as vagas" }}
        />
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {jobs.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      </section>

      {/* Eventos */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow="AGENDA"
          title="Próximos eventos"
          subtitle="Meetups, workshops e lives da comunidade."
          cta={{ to: "/eventos", label: "Ver todos os eventos" }}
        />
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      </section>

      {/* Canais */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow="ONDE A GENTE TÁ"
          title="Canais oficiais"
          subtitle="Plug-se nos canais que mais combinam com você."
        />
        <div className="mt-10">
          <ChannelGrid />
        </div>
      </section>

      {/* Depoimentos da comunidade */}
      <TestimonialsSection />

      {/* CTA Final */}
      <section className="container mx-auto px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl glass p-10 md:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-neon opacity-10" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
              Faça parte da maior <span className="text-gradient-neon">comunidade tech</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Aprenda, compartilhe, evolua e conquiste novas oportunidades ao
              lado de quem vive tecnologia todos os dias.
            </p>
            <div className="mt-8">
              <Button asChild variant="neon" size="xl">
                <Link to="/cadastro">
                  Quero entrar! <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function SectionHeader({
  eyebrow, title, subtitle, cta,
}: { eyebrow: string; title: string; subtitle?: string; cta?: { to: string; label: string } }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">{eyebrow}</div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">{title}</h2>
        {subtitle && <p className="text-muted-foreground mt-2 max-w-xl">{subtitle}</p>}
      </div>
      {cta && (
        <Button asChild variant="neon-outline" size="sm">
          <Link to={cta.to}>{cta.label} <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
        </Button>
      )}
    </div>
  );
}
