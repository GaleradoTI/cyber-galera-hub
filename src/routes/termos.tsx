import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/public-layout";
import { SITE_CONFIG } from "@/lib/site-config";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — GALERA DO T.I." },
      { name: "description", content: "Termos de uso da plataforma GALERA DO T.I." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mt-2">Versão {SITE_CONFIG.legal.termsVersion}</p>
        <div className="prose prose-invert max-w-none mt-8 space-y-4 text-muted-foreground">
          <p>Ao utilizar a plataforma {SITE_CONFIG.name} você concorda com estes Termos de Uso.</p>
          <h2 className="text-xl font-bold text-foreground">1. Conduta da comunidade</h2>
          <p>É proibido conteúdo de ódio, discriminação, spam ou ofensivo. Violações podem resultar em bloqueio da conta.</p>
          <h2 className="text-xl font-bold text-foreground">2. Conta e responsabilidade</h2>
          <p>Você é responsável por manter suas credenciais seguras e pelas atividades realizadas na sua conta.</p>
          <h2 className="text-xl font-bold text-foreground">3. Conteúdo de terceiros</h2>
          <p>Vagas, eventos e canais podem ser oferecidos por terceiros. Não nos responsabilizamos por relações estabelecidas fora da plataforma.</p>
          <h2 className="text-xl font-bold text-foreground">4. Alterações</h2>
          <p>Estes termos podem ser atualizados. A versão vigente sempre estará disponível nesta página.</p>
          <p className="text-xs">Contato: {SITE_CONFIG.email}</p>
        </div>
      </section>
    </PublicLayout>
  );
}