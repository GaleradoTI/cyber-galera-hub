import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Mínimo de 8 caracteres");
    if (password !== confirm) return toast.error("As senhas não coincidem");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard" });
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
              <PasswordInput id="p1" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p2">Confirmar</Label>
              <PasswordInput id="p2" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" variant="neon" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Atualizar senha"}
            </Button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
}