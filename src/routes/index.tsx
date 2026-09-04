import { useState } from "react";
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
import { PartnersCarousel } from "@/components/public/partners-carousel";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type HomeContent = Record<string, string>;

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
  {
    icon: Code2,
    label: "Front-end",
    color: "text-primary",
    summary: "Interfaces web e experiências que o usuário toca todos os dias.",
    detail:
      "Quem cria a camada visual dos produtos: HTML, CSS, JavaScript/TypeScript e frameworks como React, Vue e Angular. O foco está em acessibilidade, performance de renderização, design system e responsividade real em qualquer tela.",
    topics: ["React", "TypeScript", "Design System", "Acessibilidade", "Performance"],
  },
  {
    icon: Server,
    label: "Back-end",
    color: "text-secondary",
    summary: "Regras de negócio, APIs e a engrenagem por trás do produto.",
    detail:
      "Responsável por APIs, modelagem de dados, autenticação, filas e integrações. Envolve linguagens como Node.js, Python, Java, Go e C#, além de boas práticas de arquitetura, testes e observabilidade.",
    topics: ["APIs REST/GraphQL", "Node.js", "Python", "Arquitetura", "Testes"],
  },
  {
    icon: InfinityIcon,
    label: "DevOps",
    color: "text-[oklch(0.88_0.30_145)]",
    summary: "Automação, entrega contínua e infraestrutura como código.",
    detail:
      "Une desenvolvimento e operação para entregar com segurança e frequência: pipelines CI/CD, containers, orquestração, monitoramento e cultura de confiabilidade (SRE).",
    topics: ["Docker", "Kubernetes", "CI/CD", "Terraform", "Observabilidade"],
  },
  {
    icon: Database,
    label: "Data Science",
    color: "text-[oklch(0.78_0.18_65)]",
    summary: "Transformar dados brutos em decisão de negócio.",
    detail:
      "Coleta, tratamento, análise e visualização de dados, além de modelos estatísticos e preditivos. Passa por SQL, Python, engenharia de dados e storytelling com dados.",
    topics: ["SQL", "Python", "ETL", "Estatística", "BI"],
  },
  {
    icon: Shield,
    label: "Cyber Security",
    color: "text-primary",
    summary: "Proteger sistemas, dados e pessoas contra ameaças.",
    detail:
      "Abrange segurança ofensiva (pentest, red team), defensiva (blue team, SOC), resposta a incidentes, criptografia e conformidade com LGPD e normas de mercado.",
    topics: ["Pentest", "Blue Team", "LGPD", "Criptografia", "Resposta a incidentes"],
  },
  {
    icon: Smartphone,
    label: "Mobile",
    color: "text-secondary",
    summary: "Aplicativos nativos e multiplataforma para Android e iOS.",
    detail:
      "Desenvolvimento com Kotlin, Swift, React Native ou Flutter, pensando em offline-first, consumo de bateria, publicação nas lojas e experiência de uso no celular.",
    topics: ["Kotlin", "Swift", "React Native", "Flutter", "Publicação nas lojas"],
  },
  {
    icon: Cloud,
    label: "Cloud",
    color: "text-[oklch(0.88_0.30_145)]",
    summary: "Escalar aplicações com infraestrutura sob demanda.",
    detail:
      "Arquiteturas em AWS, Azure e GCP: computação serverless, redes, custos (FinOps), alta disponibilidade e estratégias de migração para nuvem.",
    topics: ["AWS", "Azure", "GCP", "Serverless", "FinOps"],
  },
  {
    icon: Brain,
    label: "AI & ML",
    color: "text-[oklch(0.78_0.18_65)]",
    summary: "Modelos, LLMs e automações inteligentes aplicadas ao produto.",
    detail:
      "Machine learning clássico, deep learning e aplicações com LLMs: engenharia de prompt, RAG, avaliação de modelos e colocação de modelos em produção (MLOps).",
    topics: ["LLMs", "RAG", "MLOps", "Deep Learning", "Automação"],
  },
];


type TechArea = (typeof TECH_AREAS)[number];

function Index() {
  const [area, setArea] = useState<TechArea | null>(null);
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

  const { data: home = {} } = useQuery({
    queryKey: ["home-content-settings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("public_site_settings")
        .select("setting_value")
        .eq("setting_key", "home_content")
        .maybeSingle();
      return (data?.setting_value ?? {}) as HomeContent;
    },
  });

  return (
    <PublicLayout>
      <Hero />
      <StatsSection />

      {/* Áreas & Tecnologias */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow={home.ecosystem_eyebrow ?? "ECOSSISTEMA"}
          title={home.ecosystem_title ?? "Áreas & Tecnologias"}
          subtitle={home.ecosystem_subtitle ?? "A comunidade reúne profissionais de todas as frentes da tecnologia."}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 sm:mt-10">
          {TECH_AREAS.map((area, i) => {
            const Icon = area.icon;
            return (
              <motion.button
                key={area.label}
                type="button"
                onClick={() => setArea(area)}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                aria-label={`Saiba mais sobre ${area.label}`}
                className="glass rounded-xl p-4 sm:p-6 min-w-0 text-left sm:text-center flex flex-row sm:flex-col items-center gap-3 hover-glow-cyan group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className={`h-7 w-7 sm:h-8 sm:w-8 shrink-0 ${area.color} group-hover:scale-110 transition-transform`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{area.label}</span>
                  <span className="block text-[11px] text-muted-foreground line-clamp-2 sm:mt-1">{area.summary}</span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <Dialog open={!!area} onOpenChange={(o) => !o && setArea(null)}>
          <DialogContent className="max-w-lg">
            {area && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-left">
                    <area.icon className={`h-5 w-5 shrink-0 ${area.color}`} />
                    <span className="min-w-0 truncate">{area.label}</span>
                  </DialogTitle>
                  <DialogDescription className="text-left">{area.summary}</DialogDescription>
                </DialogHeader>
                <p className="text-sm text-foreground/85">{area.detail}</p>
                <div className="flex flex-wrap gap-1.5">
                  {area.topics.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
                <Button asChild variant="neon" size="sm" className="w-full sm:w-auto">
                  <Link to="/vagas">Ver vagas relacionadas <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>
      </section>


      {/* Vagas */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow={home.jobs_eyebrow ?? "OPORTUNIDADES"}
          title={home.jobs_title ?? "Últimas vagas"}
          subtitle={home.jobs_subtitle ?? "Vagas curadas e publicadas direto pela equipe."}
          cta={{ to: "/vagas", label: "Ver todas as vagas" }}
        />
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {jobs.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      </section>

      {/* Eventos */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow={home.events_eyebrow ?? "AGENDA"}
          title={home.events_title ?? "Próximos eventos"}
          subtitle={home.events_subtitle ?? "Meetups, workshops e lives da comunidade."}
          cta={{ to: "/eventos", label: "Ver todos os eventos" }}
        />
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      </section>

      {/* Canais */}
      <section className="container mx-auto px-4 py-16">
        <SectionHeader
          eyebrow={home.channels_eyebrow ?? "ONDE A GENTE TÁ"}
          title={home.channels_title ?? "Canais oficiais"}
          subtitle={home.channels_subtitle ?? "Plug-se nos canais que mais combinam com você."}
        />
        <div className="mt-10">
          <ChannelGrid />
        </div>
      </section>

      <PartnersCarousel />

      {/* Depoimentos da comunidade */}
      <TestimonialsSection />

      {/* CTA Final */}
      <section className="container mx-auto px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl glass p-10 md:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-neon opacity-10" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
              {home.cta_title ?? "Faça parte da maior comunidade tech"}
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              {home.cta_description ?? "Aprenda, compartilhe, evolua e conquiste novas oportunidades ao lado de quem vive tecnologia todos os dias."}
            </p>
            <div className="mt-8">
              <Button asChild variant="neon" size="xl">
                <Link to="/cadastro">
                  {home.cta_button ?? "Quero entrar!"} <ArrowRight className="ml-2 h-4 w-4" />
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
