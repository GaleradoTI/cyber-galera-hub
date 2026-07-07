import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Download, Filter, Link2, Plus, X, Search, Pencil, Trash2, Eye, Tag as TagIcon, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { centsToMoneyInput, moneyInputToCents, moneyMask } from "@/lib/formatters";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/dashboard/financeiro")({ component: FinanceiroPage });

type Kind = "RECEITA" | "DESPESA" | "DOACAO";
type Category = { id: string; name: string; kind: Kind; color: string | null; is_active: boolean; display_order: number };
type Tag = { id: string; name: string; color: string | null; is_active: boolean };
type Entry = {
  id: string;
  kind: Kind;
  category_id: string | null;
  title: string;
  description: string | null;
  amount_cents: number;
  entry_date: string;
  status: "pending" | "confirmed" | "cancelled";
  payment_method: string | null;
  counterparty_name: string | null;
  counterparty_email: string | null;
  counterparty_phone: string | null;
  linked_user_id: string | null;
  drop_interest_id: string | null;
  attachment_url: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  finance_categories: { name: string; color: string | null; kind: Kind } | null;
  finance_entry_tags: { finance_tags: Tag }[];
  drop_interests: { drops: { title: string } | null } | null;
};

const KIND_META: Record<Kind, { label: string; sign: 1 | -1; className: string }> = {
  RECEITA: { label: "Receita", sign: 1, className: "border-emerald-500/50 text-emerald-400" },
  DESPESA: { label: "Despesa", sign: -1, className: "border-red-500/50 text-red-400" },
  DOACAO:  { label: "Doação",  sign: 1, className: "border-amber-500/50 text-amber-400" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pendente",   className: "border-yellow-500/50 text-yellow-500" },
  confirmed: { label: "Confirmado", className: "border-emerald-500/50 text-emerald-400" },
  cancelled: { label: "Cancelado",  className: "border-destructive/50 text-destructive" },
};

function FinanceiroPage() {
  const navigate = useNavigate();
  const { isAdmin, rolesReady } = useDashboardRoles();
  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  return (
    <DashboardShell title="Financeiro" description="Livro-caixa: receitas, despesas e doações.">
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries"><Layers className="h-3 w-3 mr-1" /> Lançamentos</TabsTrigger>
          <TabsTrigger value="taxonomy"><TagIcon className="h-3 w-3 mr-1" /> Categorias & Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="entries" className="mt-4"><EntriesTab /></TabsContent>
        <TabsContent value="taxonomy" className="mt-4"><TaxonomyTab /></TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

/* ------------------------------- ENTRIES ---------------------------------- */

function EntriesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [detail, setDetail] = useState<Entry | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Entry | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["finance-entries"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_entries")
        .select("*, finance_categories(name,color,kind), finance_entry_tags(finance_tags(id,name,color,is_active)), drop_interests(drops(title))")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("finance_categories").select("*").order("display_order").order("name");
      return (data ?? []) as Category[];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["finance-tags"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("finance_tags").select("*").order("name");
      return (data ?? []) as Tag[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
      if (tagFilter !== "all" && !e.finance_entry_tags?.some((t) => t.finance_tags?.id === tagFilter)) return false;
      if (originFilter === "drop" && !e.drop_interest_id) return false;
      if (originFilter === "manual" && e.drop_interest_id) return false;
      if (dateFrom && e.entry_date < dateFrom) return false;
      if (dateTo && e.entry_date > dateTo) return false;
      if (term) {
        const hay = `${e.title} ${e.counterparty_name ?? ""} ${e.counterparty_email ?? ""} ${e.description ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [entries, search, kindFilter, statusFilter, categoryFilter, tagFilter, originFilter, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const confirmed = filtered.filter((e) => e.status === "confirmed");
    const sum = (arr: Entry[]) => arr.reduce((a, e) => a + (e.amount_cents ?? 0), 0);
    const receita = sum(confirmed.filter((e) => e.kind === "RECEITA"));
    const despesa = sum(confirmed.filter((e) => e.kind === "DESPESA"));
    const doacao  = sum(confirmed.filter((e) => e.kind === "DOACAO"));
    const pending = sum(filtered.filter((e) => e.status === "pending"));
    return { receita, despesa, doacao, saldo: receita + doacao - despesa, pending, count: filtered.length };
  }, [filtered]);

  const clearFilters = () => {
    setSearch(""); setKindFilter("all"); setStatusFilter("all"); setCategoryFilter("all");
    setTagFilter("all"); setOriginFilter("all"); setDateFrom(""); setDateTo("");
  };

  const exportCSV = () => {
    downloadCSV(`financeiro-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((e) => ({
        data: e.entry_date,
        tipo: KIND_META[e.kind].label,
        categoria: e.finance_categories?.name ?? "",
        titulo: e.title,
        contraparte: e.counterparty_name ?? "",
        email: e.counterparty_email ?? "",
        telefone: e.counterparty_phone ?? "",
        usuario_vinculado: e.linked_user_id ?? "",
        origem: e.drop_interest_id ? "drop" : "manual",
        valor: centsToMoneyInput(e.amount_cents),
        status: STATUS_META[e.status]?.label ?? e.status,
        pagamento: e.payment_method ?? "",
        tags: e.finance_entry_tags?.map((t) => t.finance_tags?.name).filter(Boolean).join("; ") ?? "",
        observacao: e.note ?? "",
      })));
  };

  const refetch = () => qc.invalidateQueries({ queryKey: ["finance-entries"] });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Receita" value={centsToMoneyInput(kpis.receita)} accent="text-emerald-400" />
        <KpiCard label="Despesas" value={centsToMoneyInput(kpis.despesa)} accent="text-red-400" />
        <KpiCard label="Doações" value={centsToMoneyInput(kpis.doacao)} accent="text-amber-400" />
        <KpiCard label="Saldo" value={centsToMoneyInput(kpis.saldo)} accent={kpis.saldo >= 0 ? "text-primary" : "text-destructive"} />
        <KpiCard label="Pendente" value={centsToMoneyInput(kpis.pending)} accent="text-yellow-500" />
      </div>

      <div className="glass rounded-xl p-3 mb-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, contraparte, descrição…" />
            </div>
          </div>
          <SelectField label="Tipo" value={kindFilter} onChange={setKindFilter} options={[["all","Todos"], ...Object.entries(KIND_META).map(([k,m]) => [k,m.label] as [string,string])]} />
          <SelectField label="Categoria" value={categoryFilter} onChange={setCategoryFilter} options={[["all","Todas"], ...categories.map((c) => [c.id, `${c.name} (${KIND_META[c.kind].label})`] as [string,string])]} />
          <SelectField label="Tag" value={tagFilter} onChange={setTagFilter} options={[["all","Todas"], ...tags.map((t) => [t.id, t.name] as [string,string])]} />
          <SelectField label="Status" value={statusFilter} onChange={setStatusFilter} options={[["all","Todos"], ...Object.entries(STATUS_META).map(([k,m]) => [k,m.label] as [string,string])]} />
          <SelectField label="Origem" value={originFilter} onChange={setOriginFilter} options={[["all","Todas"],["manual","Manual"],["drop","Do drop"]]} />
          <div><Label className="text-xs">De</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3 w-3 mr-1" /> CSV</Button>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3 w-3 mr-1" /> Novo</Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" /> {filtered.length} lançamento(s)
          <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto" onClick={clearFilters}>Limpar filtros</Button>
        </div>
      </div>

      <div className="glass rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border/40 text-muted-foreground">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Categoria</th>
              <th className="text-left p-2">Título</th>
              <th className="text-left p-2">Contraparte</th>
              <th className="text-left p-2">Tags</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nenhum lançamento encontrado.</td></tr>}
            {filtered.map((e) => {
              const km = KIND_META[e.kind];
              const sm = STATUS_META[e.status] ?? STATUS_META.pending;
              return (
                <tr key={e.id} className="border-b border-border/20 hover:bg-muted/10">
                  <td className="p-2 whitespace-nowrap">{new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="p-2"><Badge variant="outline" className={`text-[10px] ${km.className}`}>{km.label}</Badge></td>
                  <td className="p-2">
                    {e.finance_categories ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: e.finance_categories.color ?? "#888" }} />
                        {e.finance_categories.name}
                      </span>
                    ) : <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="p-2">
                    <div className="font-semibold">{e.title}</div>
                    {e.drop_interest_id && <div className="text-[10px] text-muted-foreground">↳ Drop: {e.drop_interests?.drops?.title ?? "—"}</div>}
                  </td>
                  <td className="p-2">
                    <div>{e.counterparty_name ?? <span className="text-muted-foreground italic">—</span>}</div>
                    {e.linked_user_id && <div className="text-[10px] text-muted-foreground inline-flex gap-1 items-center"><Link2 className="h-3 w-3" /> vinculado</div>}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {e.finance_entry_tags?.map(({ finance_tags: t }) => t && (
                        <span key={t.id} className="inline-block px-1.5 py-0.5 rounded text-[10px] border" style={{ borderColor: t.color ?? undefined, color: t.color ?? undefined }}>{t.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className={`p-2 text-right font-mono ${km.sign > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {km.sign > 0 ? "+" : "−"}{centsToMoneyInput(e.amount_cents)}
                  </td>
                  <td className="p-2"><Badge variant="outline" className={`text-[10px] ${sm.className}`}>{sm.label}</Badge></td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDetail(e)}><Eye className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(e)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleting(e)} disabled={!!e.drop_interest_id} title={e.drop_interest_id ? "Sincronizado com pedido do drop — exclua o pedido no drop" : ""}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DetailDialog entry={detail} onClose={() => setDetail(null)} />
      {(creating || editing) && (
        <EntryFormDialog
          entry={editing}
          categories={categories}
          tags={tags}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refetch(); }}
        />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O lançamento "{deleting?.title}" será removido definitivamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleting) return;
              const { error } = await (supabase as any).from("finance_entries").delete().eq("id", deleting.id);
              if (error) return toast.error(error.message);
              toast.success("Lançamento excluído");
              setDeleting(null); refetch();
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string,string][] }) {
  return (
    <div className="w-40">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className={`flex items-center gap-1.5 text-[10px] tracking-widest ${accent}`}><DollarSign className="h-4 w-4" /> {label.toUpperCase()}</div>
      <div className="text-lg font-black mt-1">{value}</div>
    </div>
  );
}

/* --------------------------- ENTRY FORM DIALOG ---------------------------- */

type FormState = {
  kind: Kind;
  category_id: string | null;
  title: string;
  description: string;
  amount: string;
  entry_date: string;
  status: "pending" | "confirmed" | "cancelled";
  payment_method: string;
  counterparty_name: string;
  counterparty_email: string;
  counterparty_phone: string;
  linked_user_id: string | null;
  attachment_url: string;
  note: string;
  tag_ids: string[];
};

function EntryFormDialog({ entry, categories, tags, onClose, onSaved }: {
  entry: Entry | null;
  categories: Category[];
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!entry;
  const isFromDrop = !!entry?.drop_interest_id;

  const [form, setForm] = useState<FormState>(() => ({
    kind: entry?.kind ?? "RECEITA",
    category_id: entry?.category_id ?? null,
    title: entry?.title ?? "",
    description: entry?.description ?? "",
    amount: centsToMoneyInput(entry?.amount_cents ?? 0),
    entry_date: entry?.entry_date ?? new Date().toISOString().slice(0, 10),
    status: entry?.status ?? "confirmed",
    payment_method: entry?.payment_method ?? "",
    counterparty_name: entry?.counterparty_name ?? "",
    counterparty_email: entry?.counterparty_email ?? "",
    counterparty_phone: entry?.counterparty_phone ?? "",
    linked_user_id: entry?.linked_user_id ?? null,
    attachment_url: entry?.attachment_url ?? "",
    note: entry?.note ?? "",
    tag_ids: entry?.finance_entry_tags?.map((t) => t.finance_tags?.id).filter(Boolean) as string[] ?? [],
  }));
  const [userSearch, setUserSearch] = useState("");
  const [linkedUserLabel, setLinkedUserLabel] = useState<string>("");

  useEffect(() => {
    if (entry?.linked_user_id) {
      supabase.from("profiles").select("display_name,email").eq("user_id", entry.linked_user_id).maybeSingle()
        .then(({ data }) => data && setLinkedUserLabel(`${data.display_name ?? ""} · ${data.email ?? ""}`));
    }
  }, [entry?.linked_user_id]);

  const { data: userResults = [] } = useQuery({
    queryKey: ["fin-profile-search", userSearch],
    enabled: userSearch.trim().length >= 2,
    queryFn: async () => {
      const t = `%${userSearch.trim()}%`;
      const { data } = await supabase.from("profiles").select("user_id,display_name,email").or(`display_name.ilike.${t},email.ilike.${t}`).limit(8);
      return data ?? [];
    },
  });

  const filteredCats = categories.filter((c) => c.kind === form.kind && c.is_active);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Informe um título");
    const payload: any = {
      kind: form.kind,
      category_id: form.category_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount_cents: moneyInputToCents(form.amount),
      entry_date: form.entry_date,
      status: form.status,
      payment_method: form.payment_method.trim() || null,
      counterparty_name: form.counterparty_name.trim() || null,
      counterparty_email: form.counterparty_email.trim() || null,
      counterparty_phone: form.counterparty_phone.trim() || null,
      linked_user_id: form.linked_user_id,
      attachment_url: form.attachment_url.trim() || null,
      note: form.note.trim() || null,
    };

    let entryId = entry?.id;
    if (isEdit) {
      if (isFromDrop) {
        // Só permite editar campos "seguros"
        const safe = { status: payload.status, note: payload.note, attachment_url: payload.attachment_url };
        const { error } = await (supabase as any).from("finance_entries").update(safe).eq("id", entry!.id);
        if (error) return toast.error(error.message);
      } else {
        const { error } = await (supabase as any).from("finance_entries").update(payload).eq("id", entry!.id);
        if (error) return toast.error(error.message);
      }
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.created_by = u.user?.id ?? null;
      const { data, error } = await (supabase as any).from("finance_entries").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      entryId = data.id;
    }

    // Tags: replace
    if (entryId) {
      await (supabase as any).from("finance_entry_tags").delete().eq("entry_id", entryId);
      if (form.tag_ids.length) {
        await (supabase as any).from("finance_entry_tags").insert(form.tag_ids.map((tid) => ({ entry_id: entryId, tag_id: tid })));
      }
    }

    toast.success(isEdit ? "Lançamento atualizado" : "Lançamento criado");
    onSaved();
  };

  const toggleTag = (id: string) =>
    setForm((f) => ({ ...f, tag_ids: f.tag_ids.includes(id) ? f.tag_ids.filter((x) => x !== id) : [...f.tag_ids, id] }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          {isFromDrop && <DialogDescription className="text-amber-400">Sincronizado com pedido de drop — só é possível alterar status, observação e comprovante.</DialogDescription>}
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <Field label="Tipo *">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind, category_id: null })} disabled={isFromDrop}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={form.category_id ?? "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })} disabled={isFromDrop}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título *" className="md:col-span-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={isFromDrop} />
          </Field>
          <Field label="Valor *">
            <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: moneyMask(e.target.value) })} disabled={isFromDrop} />
          </Field>
          <Field label="Data *"><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} disabled={isFromDrop} /></Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Método de pagamento"><Input placeholder="pix, dinheiro, cartão…" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} disabled={isFromDrop} /></Field>
          <Field label="Contraparte — nome"><Input value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} disabled={isFromDrop} /></Field>
          <Field label="Contraparte — email"><Input type="email" value={form.counterparty_email} onChange={(e) => setForm({ ...form, counterparty_email: e.target.value })} disabled={isFromDrop} /></Field>
          <Field label="Contraparte — telefone"><Input value={form.counterparty_phone} onChange={(e) => setForm({ ...form, counterparty_phone: e.target.value })} disabled={isFromDrop} /></Field>
          <Field label="Descrição" className="md:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={isFromDrop} /></Field>

          <Field label="Usuário vinculado" className="md:col-span-2">
            {form.linked_user_id ? (
              <div className="flex items-center gap-2 p-2 rounded border border-primary/40 bg-primary/5 text-xs">
                <Link2 className="h-3 w-3" /> {linkedUserLabel || form.linked_user_id}
                <Button size="sm" variant="ghost" className="h-6 ml-auto" onClick={() => { setForm({ ...form, linked_user_id: null }); setLinkedUserLabel(""); }} disabled={isFromDrop}>Desvincular</Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input placeholder="Buscar por nome ou email…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} disabled={isFromDrop} />
                {userSearch.length >= 2 && (
                  <div className="max-h-32 overflow-y-auto border border-border/40 rounded">
                    {userResults.map((p: any) => (
                      <button key={p.user_id} type="button" className="w-full text-left p-1.5 text-xs hover:bg-muted/30"
                        onClick={() => { setForm({ ...form, linked_user_id: p.user_id }); setLinkedUserLabel(`${p.display_name ?? ""} · ${p.email ?? ""}`); setUserSearch(""); }}>
                        <b>{p.display_name ?? "(sem nome)"}</b> · <span className="text-muted-foreground">{p.email}</span>
                      </button>
                    ))}
                    {userResults.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">Nenhum</div>}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="Tags" className="md:col-span-2">
            <div className="flex flex-wrap gap-1">
              {tags.filter((t) => t.is_active).map((t) => (
                <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                  className={`px-2 py-0.5 rounded text-[10px] border ${form.tag_ids.includes(t.id) ? "bg-primary/20 border-primary" : "border-border/40"}`}
                  style={form.tag_ids.includes(t.id) ? {} : { borderColor: t.color ?? undefined, color: t.color ?? undefined }}>{t.name}</button>
              ))}
              {tags.length === 0 && <span className="text-xs text-muted-foreground italic">Nenhuma tag — crie na aba "Categorias & Tags"</span>}
            </div>
          </Field>

          <Field label="URL do comprovante" className="md:col-span-2"><Input value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} placeholder="https://…" /></Field>
          <Field label="Observação" className="md:col-span-2"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>{isEdit ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* -------------------------------- DETAIL ---------------------------------- */

function DetailDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge variant="outline" className={KIND_META[entry.kind].className}>{KIND_META[entry.kind].label}</Badge>
                {entry.title}
              </DialogTitle>
              <DialogDescription>{new Date(entry.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <DetailRow label="Valor" value={centsToMoneyInput(entry.amount_cents)} />
              <DetailRow label="Categoria" value={entry.finance_categories?.name ?? "—"} />
              <DetailRow label="Status" value={STATUS_META[entry.status]?.label ?? entry.status} />
              <DetailRow label="Pagamento" value={entry.payment_method ?? "—"} />
              <DetailRow label="Contraparte" value={entry.counterparty_name ?? "—"} />
              <DetailRow label="Email" value={entry.counterparty_email ?? "—"} />
              <DetailRow label="Telefone" value={entry.counterparty_phone ?? "—"} />
              <DetailRow label="Usuário vinculado" value={entry.linked_user_id ?? "—"} />
              <DetailRow label="Origem" value={entry.drop_interest_id ? `Drop: ${entry.drop_interests?.drops?.title ?? "—"}` : "Manual"} />
              {entry.description && <DetailRow label="Descrição" value={entry.description} />}
              {entry.note && <DetailRow label="Observação" value={entry.note} />}
              {entry.attachment_url && <DetailRow label="Comprovante" value={entry.attachment_url} />}
              {entry.finance_entry_tags?.length > 0 && (
                <DetailRow label="Tags" value={entry.finance_entry_tags.map((t) => t.finance_tags?.name).filter(Boolean).join(", ")} />
              )}
              <DetailRow label="Criado em" value={new Date(entry.created_at).toLocaleString("pt-BR")} />
              <DetailRow label="Atualizado em" value={new Date(entry.updated_at).toLocaleString("pt-BR")} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <div className="w-32 text-muted-foreground tracking-widest text-[10px] uppercase pt-0.5">{label}</div>
      <div className="flex-1 font-medium break-words">{value}</div>
    </div>
  );
}

/* ------------------------------ TAXONOMY TAB ------------------------------ */

function TaxonomyTab() {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("finance_categories").select("*").order("kind").order("display_order").order("name");
      return (data ?? []) as Category[];
    },
  });
  const { data: tags = [] } = useQuery({
    queryKey: ["finance-tags"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("finance_tags").select("*").order("name");
      return (data ?? []) as Tag[];
    },
  });

  const [newCat, setNewCat] = useState({ name: "", kind: "RECEITA" as Kind, color: "#3b82f6" });
  const [newTag, setNewTag] = useState({ name: "", color: "#3b82f6" });
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [deleteTag, setDeleteTag] = useState<Tag | null>(null);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["finance-categories"] });
    qc.invalidateQueries({ queryKey: ["finance-tags"] });
  };

  const addCat = async () => {
    if (!newCat.name.trim()) return;
    const { error } = await (supabase as any).from("finance_categories").insert({ name: newCat.name.trim(), kind: newCat.kind, color: newCat.color });
    if (error) return toast.error(error.message);
    setNewCat({ name: "", kind: "RECEITA", color: "#3b82f6" });
    toast.success("Categoria criada"); refetch();
  };
  const addTag = async () => {
    if (!newTag.name.trim()) return;
    const { error } = await (supabase as any).from("finance_tags").insert({ name: newTag.name.trim(), color: newTag.color });
    if (error) return toast.error(error.message);
    setNewTag({ name: "", color: "#3b82f6" });
    toast.success("Tag criada"); refetch();
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Categorias */}
      <div className="glass rounded-xl p-4">
        <h3 className="font-bold mb-3">Categorias</h3>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 mb-3 items-end">
          <Input placeholder="Nova categoria…" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <Select value={newCat.kind} onValueChange={(v) => setNewCat({ ...newCat, kind: v as Kind })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <input type="color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} className="h-9 w-12 rounded border border-border/40 bg-transparent" />
          <Button size="sm" onClick={addCat}><Plus className="h-3 w-3" /></Button>
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded border border-border/30 text-xs">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color ?? "#888" }} />
              <span className="font-semibold flex-1">{c.name}</span>
              <Badge variant="outline" className={`text-[9px] ${KIND_META[c.kind].className}`}>{KIND_META[c.kind].label}</Badge>
              <Switch checked={c.is_active} onCheckedChange={async (v) => {
                await (supabase as any).from("finance_categories").update({ is_active: v }).eq("id", c.id);
                refetch();
              }} />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingCat(c)}><Pencil className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteCat(c)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma categoria</p>}
        </div>
      </div>

      {/* Tags */}
      <div className="glass rounded-xl p-4">
        <h3 className="font-bold mb-3">Tags</h3>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 mb-3 items-end">
          <Input placeholder="Nova tag…" value={newTag.name} onChange={(e) => setNewTag({ ...newTag, name: e.target.value })} />
          <input type="color" value={newTag.color} onChange={(e) => setNewTag({ ...newTag, color: e.target.value })} className="h-9 w-12 rounded border border-border/40 bg-transparent" />
          <Button size="sm" onClick={addTag}><Plus className="h-3 w-3" /></Button>
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {tags.map((t) => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded border border-border/30 text-xs">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color ?? "#888" }} />
              <span className="font-semibold flex-1">{t.name}</span>
              <Switch checked={t.is_active} onCheckedChange={async (v) => {
                await (supabase as any).from("finance_tags").update({ is_active: v }).eq("id", t.id);
                refetch();
              }} />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingTag(t)}><Pencil className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteTag(t)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {tags.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tag</p>}
        </div>
      </div>

      {editingCat && <EditCategoryDialog cat={editingCat} onClose={() => setEditingCat(null)} onSaved={() => { setEditingCat(null); refetch(); }} />}
      {editingTag && <EditTagDialog tag={editingTag} onClose={() => setEditingTag(null)} onSaved={() => { setEditingTag(null); refetch(); }} />}

      <AlertDialog open={!!deleteCat} onOpenChange={(o) => !o && setDeleteCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria "{deleteCat?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Lançamentos com esta categoria ficarão sem categoria (não são apagados).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const { error } = await (supabase as any).from("finance_categories").delete().eq("id", deleteCat!.id);
              if (error) return toast.error(error.message);
              toast.success("Categoria excluída"); setDeleteCat(null); refetch();
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTag} onOpenChange={(o) => !o && setDeleteTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag "{deleteTag?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>A tag será removida de todos os lançamentos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const { error } = await (supabase as any).from("finance_tags").delete().eq("id", deleteTag!.id);
              if (error) return toast.error(error.message);
              toast.success("Tag excluída"); setDeleteTag(null); refetch();
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditCategoryDialog({ cat, onClose, onSaved }: { cat: Category; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: cat.name, kind: cat.kind, color: cat.color ?? "#3b82f6", display_order: cat.display_order });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar categoria</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Tipo">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Cor"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-16 rounded border border-border/40 bg-transparent" /></Field>
          <Field label="Ordem"><Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={async () => {
            const { error } = await (supabase as any).from("finance_categories").update(form).eq("id", cat.id);
            if (error) return toast.error(error.message);
            toast.success("Atualizado"); onSaved();
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTagDialog({ tag, onClose, onSaved }: { tag: Tag; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: tag.name, color: tag.color ?? "#3b82f6" });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar tag</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Cor"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-16 rounded border border-border/40 bg-transparent" /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={async () => {
            const { error } = await (supabase as any).from("finance_tags").update(form).eq("id", tag.id);
            if (error) return toast.error(error.message);
            toast.success("Atualizado"); onSaved();
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}