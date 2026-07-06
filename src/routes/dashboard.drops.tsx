import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ShoppingBag, Eye, Download, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploader } from "@/components/ui/image-uploader";
import { downloadCSV } from "@/lib/csv";
import { centsToMoneyInput, isValidDateOnly, moneyInputToCents } from "@/lib/formatters";
import { DateField } from "@/components/ui/date-field";
import { SizeManager } from "@/components/dashboard/size-manager";
import { DropVariantsDialog } from "@/components/dashboard/drop-variants-editor";

export const Route = createFileRoute("/dashboard/drops")({ component: DropsAdminPage });

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
  created_at: string;
  material: string | null;
  product_category: string;
  available_sizes: string[];
  size_measurements: Record<string, string>;
};

const PAYMENTS = ["Pix", "Crédito", "Débito", "Transferência", "Dinheiro"];
const CATEGORIES = [
  { value: "apparel", label: "Vestuário (camisa, casaco...)" },
  { value: "accessory", label: "Acessório" },
  { value: "sticker", label: "Adesivo" },
  { value: "other", label: "Outro" },
];

function DropsAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Drop> | null>(null);
  const [interestsOf, setInterestsOf] = useState<Drop | null>(null);
  const [deleteOf, setDeleteOf] = useState<Drop | null>(null);
  const [deleteCount, setDeleteCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [variantsOf, setVariantsOf] = useState<Drop | null>(null);

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: drops = [], isLoading } = useQuery({
    queryKey: ["admin-drops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drops").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Drop[];
    },
  });

  const { data: interests = [] } = useQuery({
    queryKey: ["drop-interests", interestsOf?.id],
    enabled: !!interestsOf?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("drop_interests").select("*").eq("drop_id", interestsOf!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const startNew = () =>
    setEditing({
      title: "", description: "", price_cents: 0, currency: "BRL", launch_date: null,
      status: "draft", pix_key: "", payment_methods: ["Pix"], images: [],
      material: "", product_category: "other", available_sizes: [], size_measurements: {},
    });

  const save = async () => {
    if (!editing) return;
    const errs: Record<string, string> = {};
    if (!editing.title?.trim()) errs.title = "Título obrigatório";
    else if (editing.title.trim().length < 3) errs.title = "Use ao menos 3 caracteres";
    if ((editing.price_cents ?? 0) < 0) errs.price = "Preço não pode ser negativo";
    if ((editing.price_cents ?? 0) > 99999999) errs.price = "Preço acima do máximo permitido";
    if (editing.launch_date && !isValidDateOnly(editing.launch_date)) errs.launch_date = "Data inválida";
    const methods = editing.payment_methods ?? [];
    if (methods.length === 0) errs.payment = "Selecione ao menos uma forma de pagamento";
    if (methods.includes("Pix")) {
      const pix = (editing.pix_key ?? "").trim();
      if (!pix) errs.pix_key = "Informe a chave Pix";
      else if (pix.length < 4) errs.pix_key = "Chave Pix muito curta";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Corrija os campos destacados");
    const payload = {
      title: editing.title!.trim(),
      description: editing.description?.trim() || null,
      price_cents: Number(editing.price_cents) || 0,
      currency: editing.currency || "BRL",
      launch_date: editing.launch_date || null,
      status: editing.status || "draft",
      pix_key: editing.pix_key?.trim() || null,
      payment_methods: editing.payment_methods ?? [],
      images: editing.images ?? [],
      created_by: user?.id ?? null,
      material: editing.material?.trim() || null,
      product_category: editing.product_category || "other",
      available_sizes: editing.available_sizes ?? [],
      size_measurements: editing.size_measurements ?? {},
    };
    const { error } = editing.id
      ? await supabase.from("drops").update(payload as any).eq("id", editing.id)
      : await supabase.from("drops").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Drop atualizado" : "Drop criado");
    setEditing(null);
    setErrors({});
    qc.invalidateQueries({ queryKey: ["admin-drops"] });
    qc.invalidateQueries({ queryKey: ["public-drops"] });
  };

  const askRemove = async (d: Drop) => {
    setDeleteOf(d);
    setDeleteCount(null);
    const { count } = await supabase
      .from("drop_interests")
      .select("id", { count: "exact", head: true })
      .eq("drop_id", d.id);
    setDeleteCount(count ?? 0);
  };

  const confirmRemove = async () => {
    if (!deleteOf) return;
    const impact = deleteCount ?? 0;
    const { error } = await supabase.from("drops").delete().eq("id", deleteOf.id);
    if (error) return toast.error(error.message);
    toast.success(`Drop excluído · ${impact} interessado(s) removido(s)`);
    setDeleteOf(null);
    qc.invalidateQueries({ queryKey: ["admin-drops"] });
    qc.invalidateQueries({ queryKey: ["public-drops"] });
  };

  const togglePayment = (m: string) => {
    const cur = editing!.payment_methods ?? [];
    setEditing({
      ...editing!,
      payment_methods: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m],
    });
  };

  const addImage = (url: string | null) => {
    if (!url) return;
    setEditing({ ...editing!, images: [...(editing!.images ?? []), url] });
  };

  const removeImage = (i: number) =>
    setEditing({ ...editing!, images: (editing!.images ?? []).filter((_, idx) => idx !== i) });

  const exportInterests = () => {
    downloadCSV(`interesses-${interestsOf?.title ?? "drop"}-${new Date().toISOString().slice(0, 10)}.csv`,
      (interests as any[]).map((i) => ({
        data: new Date(i.created_at).toLocaleString("pt-BR"),
        nome: i.full_name, email: i.email, telefone: i.phone ?? "",
        tamanho: i.size ?? "", entrega: i.delivery_method ?? "",
        endereco: [i.address_street, i.address_number, i.address_district, i.address_city, i.address_state, i.address_zip].filter(Boolean).join(", "),
        valor: centsToMoneyInput(i.amount_cents ?? 0),
        status: i.status ?? "pending", nota: i.note ?? "",
      })));
  };

  return (
    <DashboardShell title="Drops" description="Lançamentos da comunidade. Apenas administradores criam e editam.">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{drops.length} drop(s)</p>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Novo drop</Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drops.map((d) => (
          <div key={d.id} className="glass rounded-xl overflow-hidden border border-primary/20">
            {d.images?.[0] ? (
              <img src={d.images[0]} alt={d.title} className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-primary/10 flex items-center justify-center"><ShoppingBag className="h-10 w-10 text-primary/40" /></div>
            )}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate">{d.title}</h3>
                  <div className="text-xs text-primary font-bold">{centsToMoneyInput(d.price_cents)}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
              </div>
              <div className="flex gap-1 mt-3">
                <Button size="sm" variant="ghost" onClick={() => setInterestsOf(d)}><Eye className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...d })}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setVariantsOf(d)} title="Variantes"><Layers className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => askRemove(d)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar drop" : "Novo drop"}</DialogTitle>
            <DialogDescription>Preencha as informações e publique quando estiver pronto.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input maxLength={120} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>
              <div><Label>Descrição</Label><Textarea rows={4} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input inputMode="numeric" value={centsToMoneyInput(editing.price_cents ?? 0)} onChange={(e) => setEditing({ ...editing, price_cents: moneyInputToCents(e.target.value) })} />
                  {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
                </div>
                <DateField label="Data de lançamento" value={editing.launch_date ? String(editing.launch_date).slice(0, 10) : ""} onChange={(value) => setEditing({ ...editing, launch_date: value || null })} error={errors.launch_date} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status ?? "draft"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="closed">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chave Pix {(editing.payment_methods ?? []).includes("Pix") && <span className="text-destructive">*</span>}</Label>
                <Input placeholder="CPF, email, telefone ou chave aleatória" value={editing.pix_key ?? ""} onChange={(e) => setEditing({ ...editing, pix_key: e.target.value })} />
                {errors.pix_key && <p className="text-xs text-destructive mt-1">{errors.pix_key}</p>}
              </div>
              <div>
                <Label>Formas de pagamento</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {PAYMENTS.map((m) => {
                    const on = (editing.payment_methods ?? []).includes(m);
                    return (
                      <button key={m} type="button" onClick={() => togglePayment(m)}
                        className={`text-xs px-2 py-1 rounded border ${on ? "bg-primary/20 border-primary/40 text-primary" : "bg-background/40 border-border/40"}`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
                {errors.payment && <p className="text-xs text-destructive mt-1">{errors.payment}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Categoria do produto</Label>
                  <Select value={editing.product_category ?? "other"} onValueChange={(v) => setEditing({ ...editing, product_category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Material</Label>
                  <Input maxLength={120} placeholder="Ex: Algodão 100%" value={editing.material ?? ""} onChange={(e) => setEditing({ ...editing, material: e.target.value })} />
                </div>
              </div>
              {editing.product_category === "apparel" && (
                <>
                  <SizeManager
                    value={{ sizes: editing.available_sizes ?? [], measurements: editing.size_measurements ?? {} }}
                    onChange={(v) => setEditing({ ...editing, available_sizes: v.sizes, size_measurements: v.measurements })}
                    label="Tamanhos padrão do drop (usados se não houver variantes)"
                  />
                  {editing.id && (
                    <p className="text-xs text-muted-foreground">
                      Dica: use <strong>Variantes</strong> (ícone <Layers className="inline h-3 w-3" />) na lista para cadastrar modelagens diferentes (baby look, oversize, tradicional…), cada uma com seus próprios tamanhos e medidas.
                    </p>
                  )}
                </>
              )}
              <div>
                <Label>Imagens</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(editing.images ?? []).map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="" className="w-full h-20 object-cover rounded border border-border/40" />
                      <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs">×</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <ImageUploader
                    bucket="project-covers"
                    folder={`drops/${user?.id ?? "shared"}`}
                    onChange={addImage}
                    label="Adicionar imagem"
                    aspect="square"
                    maxBytes={8 * 1024 * 1024}
                    policyKey="drop_images"
                    auditEntity="drop_image"
                    auditEntityId={editing.id ?? null}
                    showDiagnostics
                    hint="Imagens em sequência viram a galeria. Veja Diagnóstico para política ativa."
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropVariantsDialog
        drop={variantsOf ? { id: variantsOf.id, title: variantsOf.title } : null}
        userId={user?.id ?? null}
        onClose={() => setVariantsOf(null)}
      />

      {/* Interessados */}
      <Dialog open={!!interestsOf} onOpenChange={(o) => !o && setInterestsOf(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Interessados — {interestsOf?.title}</DialogTitle>
            <DialogDescription>{(interests as any[]).length} pessoa(s) registraram interesse.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportInterests}><Download className="h-3 w-3 mr-1" /> Exportar CSV</Button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {(interests as any[]).map((i) => (
              <div key={i.id} className="rounded-md bg-muted/10 p-3 text-xs">
                <div className="font-semibold text-sm">{i.full_name}</div>
                <div className="text-muted-foreground">{i.email} · {i.phone ?? "—"}</div>
                {i.note && <div className="mt-1 italic">"{i.note}"</div>}
                <div className="text-[10px] text-muted-foreground/70 mt-1">{new Date(i.created_at).toLocaleString("pt-BR")}</div>
              </div>
            ))}
            {(interests as any[]).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum interessado ainda.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOf} onOpenChange={(o) => !o && setDeleteOf(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteOf?.title}"?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Esta ação não pode ser desfeita. O drop será removido do site público imediatamente.</p>
                <p>
                  <strong className="text-destructive">
                    {deleteCount === null ? "Verificando interesses…" : `${deleteCount} interessado(s) cadastrado(s)`}
                  </strong>{" "}
                  serão removidos junto com o drop e perderemos o contato deles.
                </p>
                <p className="text-xs text-muted-foreground">Se quiser preservar o histórico, marque o drop como <em>Encerrado</em> em vez de excluir.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}