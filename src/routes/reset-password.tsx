import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — GALERA DO T.I." },
      { name: "description", content: "Solicite um código seguro para redefinir sua senha." },
      { property: "og:title", content: "Recuperar senha — GALERA DO T.I." },
      { property: "og:description", content: "Solicite um código seguro para redefinir sua senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegacyResetPage,
});

function LegacyResetPage() {
  return (
    <PublicLayout>
      <section className="container mx-auto max-w-md px-4 py-20 text-center">
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-black">Recuperação atualizada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Agora a senha é recuperada por um código de 6 dígitos enviado ao seu email.
          </p>
          <Button asChild variant="neon" className="mt-5 w-full">
            <Link to="/recuperar-senha">Solicitar código</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
