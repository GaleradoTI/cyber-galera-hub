import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — GALERA DO T.I." },
      { name: "description", content: "Receba um código no seu email para redefinir a senha da sua conta GALERA DO T.I." },
      { property: "og:title", content: "Recuperar senha — GALERA DO T.I." },
      { property: "og:description", content: "Receba um código no seu email para redefinir sua senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return toast.error("Informe seu email");

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: false },
    });
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success("Enviamos um código de 6 dígitos para seu email.");
    navigate({ to: "/verificar-codigo", search: { email: normalized } });
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-20 max-w-md">
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gradient-neon">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passo 1 de 3 — informe seu email e enviaremos um código de verificação.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" variant="neon" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar código"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-6">
            Já tem o código?{" "}
            <Link to="/verificar-codigo" search={{ email: "" }} className="text-primary hover:underline font-medium">Inserir código</Link>
          </p>
          <p className="text-sm text-center text-muted-foreground mt-2">
            <Link to="/login" className="text-secondary hover:underline">Voltar para o login</Link>
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
