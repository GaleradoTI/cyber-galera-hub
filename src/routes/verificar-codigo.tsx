import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { requestPasswordReset, verifyPasswordResetCode } from "@/lib/password-reset.functions";

export const Route = createFileRoute("/verificar-codigo")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search['email'] === "string" ? (search['email'] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Verificar código — GALERA DO T.I." },
      { name: "description", content: "Digite o código de 6 dígitos enviado para o seu email e continue a redefinição de senha." },
      { property: "og:title", content: "Verificar código — GALERA DO T.I." },
      { property: "og:description", content: "Digite o código de verificação enviado para o seu email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerificarCodigoPage,
});

function VerificarCodigoPage() {
  const navigate = useNavigate();
  const { email: initialEmail } = Route.useSearch();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const verifyCode = useServerFn(verifyPasswordResetCode);
  const requestReset = useServerFn(requestPasswordReset);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return toast.error("Informe o email");
    if (code.length !== 6) return toast.error("O código tem 6 dígitos");

    setLoading(true);
    try {
      const result = await verifyCode({ data: { email: normalized, code } });
      sessionStorage.setItem("password-reset-ticket", result.ticket);
      toast.success("Código confirmado! Defina sua nova senha.");
      navigate({ to: "/nova-senha", search: { email: normalized } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código inválido ou expirado");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return toast.error("Informe o email");
    setResending(true);
    try {
      const result = await requestReset({ data: { email: normalized } });
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reenviar o código.");
    } finally {
      setResending(false);
    }
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-20 max-w-md">
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gradient-neon">Verificar código</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passo 2 de 3 — digite o código de 6 dígitos que enviamos por email.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Código de verificação</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup className="w-full justify-between">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" variant="neon" className="w-full" disabled={loading}>
              {loading ? "Verificando..." : "Confirmar código"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-between text-sm">
            <button type="button" onClick={onResend} disabled={resending} className="text-secondary hover:underline">
              {resending ? "Reenviando..." : "Reenviar código"}
            </button>
            <Link to="/recuperar-senha" className="text-muted-foreground hover:underline">Trocar email</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
