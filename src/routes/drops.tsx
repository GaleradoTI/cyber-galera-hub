import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ShoppingBag, Calendar, Tag, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicMascotSpot } from "@/components/public/public-mascot-spot";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatPhone } from "@/lib/formatters";
import { formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/drops")({
  head: () => ({
    meta: [
      { title: "Drops — GALERA DO T.I." },
      { name: "description", content: "Lançamentos de roupas, adesivos e produtos exclusivos da comunidade." },
      { property: "og:title", content: "Drops — GALERA DO T.I." },
      { property: "og:description", content: "Reserve sua peça do próximo drop." },
    ],
  }),
  component: DropsPublicPage,
});

type Drop = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  launch_date: string | null;
  status: string;
  pix_key: string | null;
  payment_methods: string[];
  images: string[];
};

const interestSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim()
    .min(10, "Telefone deve ter DDD + número")
    .max(20)
    .regex(/^[\d\s()+-]+$/, "Use apenas números, espaços e ( ) + -"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

const fmtPrice = (cents: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);

function DropsPublicPage() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState<Drop | null>(null);
  const [interestOpen, setInterestOpen] = useState<Drop | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: drops = [], isLoading } = useQuery({
    queryKey: ["public-drops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drops")
        .select("*")
        .eq("status", "published")
        .order("launch_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Drop[];
    },
  });

  // Pré-preenchimento via profile do usuário
  useEffect(() => {
    if (!interestOpen || !user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name,email,phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          full_name: f.full_name || (data as any).display_name || "",
          email: f.email || (data as any).email || "",
          phone: f.phone || (data as any).phone || "",
        }));
      }
    })();
  }, [interestOpen, user?.id]);

  const submitInterest = async () => {
    if (!interestOpen) return;
    const parsed = interestSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return toast.error("Corrija os campos destacados");
    }
    setFieldErrors({});
    setSubmitting(true);
    const { error } = await supabase.from("drop_interests").insert({
      drop_id: interestOpen.id,
      user_id: user?.id ?? null,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      note: parsed.data.note || null,
    });
    setSubmitting(false);
    if (error) return toast.error(`Não foi possível registrar: ${error.message}`);
    toast.success("Interesse registrado! Em breve entraremos em contato.");
    setInterestOpen(null);
    setForm({ full_name: "", email: "", phone: "", note: "" });
    setFieldErrors({});
  };

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-[1fr_220px] gap-8 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">LANÇAMENTOS DA COMUNIDADE</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight flex items-center gap-3">
              <ShoppingBag className="h-9 w-9 text-primary" /> Drops
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Roupas, adesivos e produtos oficiais da Galera. Reserve seu interesse para garantir o seu.
            </p>
          </div>
          <PublicMascotSpot placement="drops" className="hidden lg:flex" />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground mt-10">Carregando…</p>
        ) : drops.length === 0 ? (
          <p className="text-muted-foreground mt-10">Nenhum drop publicado no momento.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {drops.map((d) => (
              <button
                key={d.id}
                onClick={() => setOpen(d)}
                className="text-left glass rounded-xl overflow-hidden hover-glow-cyan group transition"
              >
                {d.images?.[0] ? (
                  <img src={d.images[0]} alt={d.title} loading="lazy" className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-primary/10 flex items-center justify-center">
                    <ShoppingBag className="h-12 w-12 text-primary/40" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-bold text-base truncate group-hover:text-gradient-neon transition">{d.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-lg font-black text-primary">{fmtPrice(d.price_cents, d.currency)}</div>
                    {d.launch_date && (
                      <Badge variant="outline" className="text-[10px]">
                        <Calendar className="h-3 w-3 mr-1" /> {formatDateOnly(d.launch_date)}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Detalhes do drop */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{open.title}</DialogTitle>
                <DialogDescription>{fmtPrice(open.price_cents, open.currency)}</DialogDescription>
              </DialogHeader>
              {open.images?.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {open.images.map((img, i) => (
                    <img key={i} src={img} alt="" className="w-full h-40 object-cover rounded-md border border-border/40" />
                  ))}
                </div>
              )}
              {open.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{open.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {open.launch_date && (
                  <div className="rounded bg-muted/20 p-2">
                    <div className="text-[10px] tracking-widest text-muted-foreground/70">LANÇAMENTO</div>
                    <div className="font-semibold">{formatDateOnly(open.launch_date)}</div>
                  </div>
                )}
                <div className="rounded bg-muted/20 p-2">
                  <div className="text-[10px] tracking-widest text-muted-foreground/70">PAGAMENTO</div>
                  <div className="font-semibold flex flex-wrap gap-1">
                    {(open.payment_methods?.length ? open.payment_methods : ["Pix"]).map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px]"><Tag className="h-3 w-3 mr-1" />{m}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              {open.pix_key && (
                <div className="text-xs rounded bg-muted/10 p-2">
                  <span className="text-muted-foreground">Chave Pix:</span> <code className="font-mono">{open.pix_key}</code>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setInterestOpen(open); setOpen(null); }} className="w-full">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Tenho interesse
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Formulário de interesse */}
      <Dialog open={!!interestOpen} onOpenChange={(o) => !o && setInterestOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tenho interesse — {interestOpen?.title}</DialogTitle>
            <DialogDescription>
              {isAuthenticated
                ? "Confirme seus dados para a gente entrar em contato sobre o drop."
                : "Deixe seus dados para garantir sua unidade. Receberemos a confirmação aqui."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input maxLength={100} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              {fieldErrors.full_name && <p className="text-xs text-destructive mt-1">{fieldErrors.full_name}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {fieldErrors.email && <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>}
            </div>
            <div>
              <Label>Telefone</Label>
              <Input inputMode="tel" maxLength={20} placeholder="(11) 90000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
              {fieldErrors.phone && <p className="text-xs text-destructive mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              {fieldErrors.note && <p className="text-xs text-destructive mt-1">{fieldErrors.note}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInterestOpen(null)}>Cancelar</Button>
            <Button onClick={submitInterest} disabled={submitting}>{submitting ? "Enviando…" : "Confirmar interesse"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}