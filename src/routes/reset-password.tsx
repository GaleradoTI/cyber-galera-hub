import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { PasswordChecklist, validatePassword } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Redefinir senha — GALERA DO T.I." }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  // Garante que o código de recuperação vindo do e-mail seja trocado por uma sessão válida
  useEffect(() => {
    let mounted = true;

    async function ensureRecoverySession() {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (mounted) setSessionReady(true);
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (!code) {
        if (mounted) setSessionError(true);
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        if (mounted) setSessionError(true);
        return;
      }
      if (mounted) setSessionReady(true);
    }

    // Também escuta o evento PASSWORD_RECOVERY, caso o SDK já processe automaticamente
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setSessionReady(true);
        setSessionError(false);
      }
    });

    ensureRecoverySession();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!sessionReady) {
      toast.error("Link de recuperação inválido ou expirado. Solicite um novo.");
      return;
    }

    const { ok, missing } = validatePassword(password);
    if (!ok) return toast.error(`Senha fraca: falta ${missing.join(", ").toLowerCase()}`);
    if (password !== confirm) return toast.error("As senhas não coincidem");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return toast.error(error.message);

    toast.success("Senha atualizada!");
    // Encerra a sessão de recuperação e força novo login com a senha nova
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (sessionError) {
    return (
      <PublicLayout>
        <section className="container mx-auto px-4 py-20 max-w-md text-center">
          <div className="glass rounded-2xl p-8">
            <h1 className="text-2xl font-black">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Solicite um novo link de redefinição de senha.
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate({ to: "/forgot-password" })}>
              Solicitar novo link
            </Button>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-20 max-w-md">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-3xl font-black tracking-tight text-gradient-neon">Nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina uma nova senha para sua conta.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p1">Nova senha</Label>
              <PasswordInput
                id="p1"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!sessionReady}
              />
              <PasswordChecklist value={password} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p2">Confirmar</Label>
              <PasswordInput
                id="p2"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!sessionReady}
              />
            </div>
            <Button type="submit" variant="neon" className="w-full" disabled={loading || !sessionReady}>
              {loading ? "Salvando..." : sessionReady ? "Atualizar senha" : "Validando link..."}
            </Button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
}
