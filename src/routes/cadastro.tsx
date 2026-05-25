import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { SITE_CONFIG } from "@/lib/site-config";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — GALERA DO T.I." },
      { name: "description", content: "Cadastre-se na comunidade GALERA DO T.I. e desbloqueie todos os recursos." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirm: "",
    newsletter: false,
    acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Senha deve ter no mínimo 8 caracteres");
    if (form.password !== form.confirm) return toast.error("As senhas não coincidem");
    if (!form.acceptTerms) return toast.error("Você precisa aceitar os Termos e a Política de Privacidade");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          display_name: form.displayName,
          newsletter_opt_in: form.newsletter,
        },
      },
    });

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    // Registra consentimento LGPD se já houver sessão
    if (data.user) {
      await supabase.from("lgpd_consents").insert({
        user_id: data.user.id,
        terms_version: SITE_CONFIG.legal.termsVersion,
        privacy_policy_version: SITE_CONFIG.legal.privacyVersion,
        consent_status: true,
        consent_origin: "signup",
      });
    }

    setLoading(false);
    toast.success("Conta criada! Verifique seu email se necessário.");
    navigate({ to: "/dashboard" });
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16 max-w-md">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-3xl font-black tracking-tight text-gradient-neon">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Junte-se à comunidade</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome de exibição</Label>
              <Input id="name" required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha (mín. 8)</Label>
              <PasswordInput id="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <PasswordInput id="confirm" minLength={8} required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={form.newsletter} onCheckedChange={(v) => setForm({ ...form, newsletter: !!v })} />
              <span>Quero receber novidades, vagas e eventos por email.</span>
            </label>

            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={form.acceptTerms} onCheckedChange={(v) => setForm({ ...form, acceptTerms: !!v })} />
              <span>
                Li e aceito os{" "}
                <Link to="/termos" className="text-secondary hover:underline">Termos de Uso</Link> e a{" "}
                <Link to="/privacidade" className="text-secondary hover:underline">Política de Privacidade</Link>.
              </span>
            </label>

            <Button type="submit" variant="neon" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-6">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}