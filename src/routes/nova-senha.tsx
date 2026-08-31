import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { PasswordChecklist, validatePassword } from "@/lib/password-policy";

export const Route = createFileRoute("/nova-senha")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — GALERA DO T.I." },
      { name: "description", content: "Última etapa: defina a nova senha da sua conta GALERA DO T.I." },
      { property: "og:title", content: "Definir nova senha — GALERA DO T.I." },
      { property: "og:description", content: "Defina a nova senha da sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { ok, missing } = validatePassword(password);
    if (!ok) return toast.error(`Senha fraca: falta ${missing.join(", ").toLowerCase()}`);
    if (password !== confirm) return toast.error("As senhas não coincidem");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);

    toast.success("Senha atualizada! Faça login com a nova senha.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (!checking && !hasSession) {
    return (
      <PublicLayout>
        <section className="container mx-auto px-4 py-20 max-w-md text-center">
          <div className="glass rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-black">Verificação necessária</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Valide o código enviado ao seu email antes de definir uma nova senha.
            </p>
            <Button asChild variant="neon" className="mt-4 w-full">
              <Link to="/recuperar-senha">Solicitar novo código</Link>
            </Button>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-20 max-w-md">
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gradient-neon">Nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Passo 3 de 3 — defina sua nova senha.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p1">Nova senha</Label>
              <PasswordInput id="p1" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} disabled={checking} />
              <PasswordChecklist value={password} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p2">Confirmar senha</Label>
              <PasswordInput id="p2" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={checking} />
            </div>
            <Button type="submit" variant="neon" className="w-full" disabled={loading || checking}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
}
