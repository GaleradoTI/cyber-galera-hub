import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { SITE_CONFIG } from "@/lib/site-config";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — GALERA DO T.I." },
      { name: "description", content: "Conheça a comunidade GALERA DO T.I., nossa missão e nossos valores." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  const { data: about = {} } = useQuery({
    queryKey: ["about-settings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("public_site_settings").select("setting_value").eq("setting_key", "about").maybeSingle();
      return (data?.setting_value ?? {}) as Record<string, any>;
    },
  });
  const values = Array.isArray(about.values) ? about.values : String(about.values ?? "").split(";").filter(Boolean);

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-[1fr_280px] gap-10 items-start max-w-5xl mx-auto">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">SOBRE NÓS</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              {about.hero_title ?? "Comunidade"} <span className="text-gradient-neon">{SITE_CONFIG.name}</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-6">{about.hero_subtitle ?? SITE_CONFIG.slogan}</p>
          </div>
          <PublicMascotSpot placement="about" className="hidden lg:flex justify-self-center" />
        </div>

        <div className="prose prose-invert max-w-3xl mx-auto mt-10 space-y-6 text-muted-foreground">
          <h2 className="text-2xl font-bold text-foreground">{about.story_title ?? "Nossa história"}</h2>
          <p>{about.story_body ?? `A ${SITE_CONFIG.name} nasceu para conectar profissionais e entusiastas de tecnologia em um espaço seguro, plural e produtivo. Aqui você encontra networking, conteúdo técnico, oportunidades de carreira e eventos.`}</p>
          <h2 className="text-2xl font-bold text-foreground">{about.mission_title ?? "Nossa missão"}</h2>
          <p>{about.mission ?? "Democratizar o acesso a conhecimento e oportunidades em T.I., conectando pessoas que constroem o futuro com tecnologia."}</p>
          {about.vision && <><h2 className="text-2xl font-bold text-foreground">Nossa visão</h2><p>{about.vision}</p></>}
          <h2 className="text-2xl font-bold text-foreground">{about.values_title ?? "Nossos valores"}</h2>
          <ul className="list-disc list-inside space-y-2">
            {(values.length ? values : ["Comunidade aberta, diversa e respeitosa", "Compartilhamento de conhecimento", "Crescimento técnico e profissional", "Transparência e ética"]).map((value: string) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}