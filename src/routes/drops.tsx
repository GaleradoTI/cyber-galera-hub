import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ShoppingBag, Calendar, Tag, CheckCircle2, Ruler, Lock } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  material: string | null;
  product_category: string;
  available_sizes: string[];
  size_measurements: Record<string, string>;
};

type Variant = {
  id: string;
  drop_id: string;
  name: string;
  material: string | null;
  price_cents: number | null;
  available_sizes: string[];
  size_measurements: Record<string, string>;
  images: string[];
  display_order: number;
};

const baseSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim()
    .min(10, "Telefone deve ter DDD + número")
    .max(20)
    .regex(/^[\d\s()+-]+$/, "Use apenas números, espaços e ( ) + -"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  size: z.string().trim().max(20).optional().or(z.literal("")),
  delivery_method: z.enum(["pickup", "shipping"]).optional(),
  address_zip: z.string().trim().max(15).optional().or(z.literal("")),
  address_street: z.string().trim().max(150).optional().or(z.literal("")),
  address_number: z.string().trim().max(20).optional().or(z.literal("")),
  address_complement: z.string().trim().max(80).optional().or(z.literal("")),
  address_district: z.string().trim().max(80).optional().or(z.literal("")),
  address_city: z.string().trim().max(80).optional().or(z.literal("")),
  address_state: z.string().trim().max(2).optional().or(z.literal("")),
});

const fmtPrice = (cents: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);

function DropsPublicPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Drop | null>(null);
  const [interestOpen, setInterestOpen] = useState<Drop | null>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", note: "",
    size: "", delivery_method: "pickup" as "pickup" | "shipping",
    address_zip: "", address_street: "", address_number: "",
    address_complement: "", address_district: "", address_city: "", address_state: "",
  });
  const [variantId, setVariantId] = useState<string | null>(null);
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
      return (data ?? []).map((d: any) => ({
        ...d,
        size_measurements: (d.size_measurements ?? {}) as Record<string, string>,
        available_sizes: (d.available_sizes ?? []) as string[],
      })) as Drop[];
    },
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["public-drop-variants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drop_variants").select("*").eq("is_active", true).order("display_order");
      if (error) return [];
      return (data ?? []).map((v: any) => ({
        ...v,
        available_sizes: v.available_sizes ?? [],
        size_measurements: (v.size_measurements ?? {}) as Record<string, string>,
        images: v.images ?? [],
      })) as Variant[];
    },
  });

  const variantsByDrop = useMemo(() => {
    const m = new Map<string, Variant[]>();
    variants.forEach((v) => { const arr = m.get(v.drop_id) ?? []; arr.push(v); m.set(v.drop_id, arr); });
    return m;
  }, [variants]);

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

  const openInterest = (d: Drop) => {
    if (!isAuthenticated) {
      toast.info("Faça login para reservar seu drop.");
      navigate({ to: "/login", search: { redirect: "/drops" } as any });
      return;
    }
    setInterestOpen(d);
    setOpen(null);
    const dv = variantsByDrop.get(d.id) ?? [];
    setVariantId(dv[0]?.id ?? null);
    setForm((f) => ({ ...f, size: "" }));
  };

  const submitInterest = async () => {
    if (!interestOpen) return;
    if (!user?.id) {
      toast.error("Você precisa estar logado.");
      return;
    }
    const parsed = baseSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return toast.error("Corrija os campos destacados");
    }
    const isApparel = interestOpen.product_category === "apparel";
    const dropVariants = variantsByDrop.get(interestOpen.id) ?? [];
    const chosenVariant = dropVariants.find((v) => v.id === variantId) ?? null;
    const errs: Record<string, string> = {};
    if (isApparel) {
      if (!form.size) errs.size = "Selecione o tamanho";
      if (dropVariants.length > 0 && !chosenVariant) errs.size = "Escolha a modelagem";
      if (!form.delivery_method) errs.delivery_method = "Escolha a forma de entrega";
      if (form.delivery_method === "shipping") {
        if (!form.address_zip.trim()) errs.address_zip = "CEP obrigatório";
        if (!form.address_street.trim()) errs.address_street = "Rua obrigatória";
        if (!form.address_number.trim()) errs.address_number = "Número obrigatório";
        if (!form.address_city.trim()) errs.address_city = "Cidade obrigatória";
        if (!form.address_state.trim()) errs.address_state = "UF obrigatória";
      }
    }
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return toast.error("Corrija os campos destacados");
    }
    setFieldErrors({});
    setSubmitting(true);
    const priceForOrder = chosenVariant?.price_cents ?? interestOpen.price_cents;
    const payload: any = {
      drop_id: interestOpen.id,
      user_id: user.id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      note: parsed.data.note || null,
      amount_cents: priceForOrder,
      status: "pending",
      size: isApparel ? form.size : null,
      delivery_method: isApparel ? form.delivery_method : null,
      variant_id: chosenVariant?.id ?? null,
    };
    if (isApparel && form.delivery_method === "shipping") {
      Object.assign(payload, {
        address_zip: form.address_zip.trim(),
        address_street: form.address_street.trim(),
        address_number: form.address_number.trim(),
        address_complement: form.address_complement.trim() || null,
        address_district: form.address_district.trim() || null,
        address_city: form.address_city.trim(),
        address_state: form.address_state.trim().toUpperCase(),
      });
    }
    const { error } = await supabase.from("drop_interests").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(`Não foi possível registrar: ${error.message}`);
    toast.success("Reserva registrada! Em breve entraremos em contato.");
    setInterestOpen(null);
    setVariantId(null);
    setForm({
      full_name: "", email: "", phone: "", note: "",
      size: "", delivery_method: "pickup",
      address_zip: "", address_street: "", address_number: "",
      address_complement: "", address_district: "", address_city: "", address_state: "",
    });
    setFieldErrors({});
  };

  const isApparel = interestOpen?.product_category === "apparel";
  const dropVariants = interestOpen ? variantsByDrop.get(interestOpen.id) ?? [] : [];
  const chosenVariant = dropVariants.find((v) => v.id === variantId) ?? null;
  const activeSizes = chosenVariant?.available_sizes.length
    ? chosenVariant.available_sizes
    : interestOpen?.available_sizes ?? [];
  const activeMeasurements = chosenVariant?.size_measurements ?? interestOpen?.size_measurements ?? {};
  const currentMeasurement = form.size ? activeMeasurements?.[form.size] : null;

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
                {open.material && (
                  <div className="rounded bg-muted/20 p-2">
                    <div className="text-[10px] tracking-widest text-muted-foreground/70">MATERIAL</div>
                    <div className="font-semibold">{open.material}</div>
                  </div>
                )}
                {open.available_sizes?.length > 0 && (
                  <div className="rounded bg-muted/20 p-2">
                    <div className="text-[10px] tracking-widest text-muted-foreground/70">TAMANHOS</div>
                    <div className="font-semibold">{open.available_sizes.join(" · ")}</div>
                  </div>
                )}
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
                <Button onClick={() => openInterest(open)} className="w-full">
                  {isAuthenticated
                    ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Quero este drop</>
                    : <><Lock className="h-4 w-4 mr-2" /> Faça login para reservar</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Formulário de interesse */}
      <Dialog open={!!interestOpen} onOpenChange={(o) => !o && setInterestOpen(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reservar — {interestOpen?.title}</DialogTitle>
            <DialogDescription>
              Confirme seus dados{isApparel ? ", tamanho e forma de entrega" : ""}.
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

            {isApparel && (
              <>
                {dropVariants.length > 0 && (
                  <div>
                    <Label>Modelagem</Label>
                    <RadioGroup
                      value={variantId ?? ""}
                      onValueChange={(v) => { setVariantId(v); setForm({ ...form, size: "" }); }}
                      className="mt-2 space-y-1"
                    >
                      {dropVariants.map((v) => (
                        <label key={v.id} className="flex items-start gap-2 text-sm cursor-pointer rounded border border-border/40 p-2 hover:border-primary/40">
                          <RadioGroupItem value={v.id} className="mt-1" />
                          <div className="flex-1">
                            <div className="font-semibold">{v.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {v.material ?? ""}
                              {v.price_cents != null && ` · ${fmtPrice(v.price_cents, interestOpen!.currency)}`}
                            </div>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                <div>
                  <Label>Tamanho</Label>
                  <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v })}>
                    <SelectTrigger><SelectValue placeholder="Escolha o tamanho" /></SelectTrigger>
                    <SelectContent>
                      {activeSizes.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentMeasurement && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Ruler className="h-3 w-3" /> {currentMeasurement}
                    </p>
                  )}
                  {fieldErrors.size && <p className="text-xs text-destructive mt-1">{fieldErrors.size}</p>}
                </div>
                <div>
                  <Label>Como quer receber?</Label>
                  <RadioGroup
                    value={form.delivery_method}
                    onValueChange={(v) => setForm({ ...form, delivery_method: v as "pickup" | "shipping" })}
                    className="mt-2"
                  >
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value="pickup" /> Retirar em mãos com a organização
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value="shipping" /> Enviar pelo correio
                    </label>
                  </RadioGroup>
                  {fieldErrors.delivery_method && <p className="text-xs text-destructive mt-1">{fieldErrors.delivery_method}</p>}
                </div>
                {form.delivery_method === "shipping" && (
                  <div className="space-y-2 rounded-md border border-border/40 p-3 bg-muted/10">
                    <div className="text-[10px] tracking-widest text-muted-foreground/70">ENDEREÇO DE ENTREGA</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <Label>CEP</Label>
                        <Input maxLength={9} value={form.address_zip} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} />
                        {fieldErrors.address_zip && <p className="text-xs text-destructive mt-1">{fieldErrors.address_zip}</p>}
                      </div>
                      <div className="col-span-2">
                        <Label>Rua</Label>
                        <Input maxLength={150} value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
                        {fieldErrors.address_street && <p className="text-xs text-destructive mt-1">{fieldErrors.address_street}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Nº</Label>
                        <Input maxLength={20} value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
                        {fieldErrors.address_number && <p className="text-xs text-destructive mt-1">{fieldErrors.address_number}</p>}
                      </div>
                      <div className="col-span-2">
                        <Label>Complemento</Label>
                        <Input maxLength={80} value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input maxLength={80} value={form.address_district} onChange={(e) => setForm({ ...form, address_district: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Label>Cidade</Label>
                        <Input maxLength={80} value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} />
                        {fieldErrors.address_city && <p className="text-xs text-destructive mt-1">{fieldErrors.address_city}</p>}
                      </div>
                      <div>
                        <Label>UF</Label>
                        <Input maxLength={2} value={form.address_state} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} />
                        {fieldErrors.address_state && <p className="text-xs text-destructive mt-1">{fieldErrors.address_state}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Observação (opcional)</Label>
              <Textarea rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              {fieldErrors.note && <p className="text-xs text-destructive mt-1">{fieldErrors.note}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInterestOpen(null)}>Cancelar</Button>
            <Button onClick={submitInterest} disabled={submitting}>{submitting ? "Enviando…" : "Confirmar reserva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}