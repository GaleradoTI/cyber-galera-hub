import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/public-layout";
import { SITE_CONFIG } from "@/lib/site-config";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — GALERA DO T.I." },
      { name: "description", content: "Como tratamos seus dados na plataforma GALERA DO T.I." },
    ],
  }),
  component: PrivPage,
});

function PrivPage() {
  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mt-2">Versão {SITE_CONFIG.legal.privacyVersion} · Compatível com a LGPD (Lei nº 13.709/2018)</p>
        <div className="prose prose-invert max-w-none mt-8 space-y-4 text-muted-foreground">
          <h2 className="text-xl font-bold text-foreground">1. Dados coletados</h2>
          <p>Coletamos nome de exibição, email, e dados de uso necessários para a operação da plataforma.</p>
          <h2 className="text-xl font-bold text-foreground">2. Finalidade</h2>
          <p>Usamos seus dados para autenticação, comunicação institucional, vagas, eventos e melhoria contínua do serviço.</p>
          <h2 className="text-xl font-bold text-foreground">3. Seus direitos (LGPD)</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Acessar, corrigir ou excluir seus dados</li>
            <li>Revogar o consentimento de comunicação a qualquer momento</li>
            <li>Solicitar portabilidade ou anonimização</li>
          </ul>
          <h2 className="text-xl font-bold text-foreground">4. Segurança</h2>
          <p>Adotamos práticas de segurança como criptografia em trânsito, controle de acesso por roles e Row-Level Security no banco de dados.</p>
          <h2 className="text-xl font-bold text-foreground">5. Contato</h2>
          <p>Para exercer seus direitos, envie email para {SITE_CONFIG.email}.</p>
        </div>
      </section>
    </PublicLayout>
  );
}