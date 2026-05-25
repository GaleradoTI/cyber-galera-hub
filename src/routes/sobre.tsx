import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/public-layout";
import { SITE_CONFIG } from "@/lib/site-config";

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
  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">SOBRE NÓS</div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          Comunidade <span className="text-gradient-neon">{SITE_CONFIG.name}</span>
        </h1>
        <p className="text-lg text-muted-foreground mt-6">{SITE_CONFIG.slogan}</p>

        <div className="prose prose-invert max-w-none mt-10 space-y-6 text-muted-foreground">
          <p>A {SITE_CONFIG.name} nasceu para conectar profissionais e entusiastas de tecnologia em um espaço seguro, plural e produtivo. Aqui você encontra networking, conteúdo técnico, oportunidades de carreira e eventos.</p>
          <h2 className="text-2xl font-bold text-foreground">Nossa missão</h2>
          <p>Democratizar o acesso a conhecimento e oportunidades em T.I., conectando pessoas que constroem o futuro com tecnologia.</p>
          <h2 className="text-2xl font-bold text-foreground">Nossos valores</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Comunidade aberta, diversa e respeitosa</li>
            <li>Compartilhamento de conhecimento</li>
            <li>Crescimento técnico e profissional</li>
            <li>Transparência e ética</li>
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}