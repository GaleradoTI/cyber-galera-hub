import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — GALERA DO T.I." },
      { name: "description", content: "Acesse sua conta na comunidade GALERA DO T.I." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  }

  async function onForgot() {
    if (!email) return toast.error("Informe o email primeiro");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link para seu email.");
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-20 max-w-md">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-3xl font-black tracking-tight text-gradient-neon">Entrar</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesse a comunidade</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Senha</Label>
                <button type="button" onClick={onForgot} className="text-xs text-secondary hover:underline">
                  Esqueci a senha
                </button>
              </div>
              <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="neon" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-6">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="text-primary hover:underline font-medium">
              Cadastre-se
            </Link>
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}