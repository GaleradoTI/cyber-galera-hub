import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Download, Filter, Link2, PackageCheck, Truck, X, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { centsToMoneyInput } from "@/lib/formatters";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/dashboard/financeiro")({ component: FinanceiroPage });

type Row = {
  id: string;
  drop_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  size: string | null;
  delivery_method: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
  user_id: string | null;
  linked_user_id: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  note: string | null;
  drops: { title: string; product_category: string } | null;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "border-yellow-500/50 text-yellow-500" },
  paid: { label: "Pago", className: "border-emerald-500/50 text-emerald-400" },
  delivered: { label: "Entregue", className: "border-primary/50 text-primary" },
  cancelled: { label: "Cancelado", className: "border-destructive/50 text-destructive" },
};

const CATEGORY_LABEL: Record<string, string> = {
  apparel: "Vestuário",
  accessory: "Acessório",
  sticker: "Adesivo",
  other: "Outro",
};

function FinanceiroPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, rolesReady } = useDashboardRoles();

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [dropFilter, setDropFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [linkFor, setLinkFor] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["financeiro-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drop_interests")
        .select("*, drops:drop_id(title, product_category)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const dropOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => { if (r.drops?.title) seen.set(r.drop_id, r.drops.title); });
    return Array.from(seen.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter !== "all" && (r.drops?.product_category ?? "other") !== categoryFilter) return false;
      if (deliveryFilter !== "all" && (r.delivery_method ?? "") !== deliveryFilter) return false;
      if (dropFilter !== "all" && r.drop_id !== dropFilter) return false;
      if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(r.created_at) > new Date(dateTo + "T23:59:59")) return false;
      if (term) {
        const hay = `${r.full_name} ${r.email} ${r.phone ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, categoryFilter, deliveryFilter, dropFilter, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const paid = filtered.filter((r) => r.status === "paid" || r.status === "delivered");
    const revenue = paid.reduce((a, r) => a + (r.amount_cents ?? 0), 0);
    const pending = filtered.filter((r) => r.status === "pending").reduce((a, r) => a + (r.amount_cents ?? 0), 0);
    return {
      revenue,
      pending,
      orders: filtered.length,
      avg: paid.length ? Math.round(revenue / paid.length) : 0,
    };
  }, [filtered]);

  const setStatus = async (row: Row, status: string) => {
    const { error } = await supabase.from("drop_interests").update({ status } as any).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["financeiro-orders"] });
  };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setCategoryFilter("all");
    setDeliveryFilter("all"); setDropFilter("all"); setDateFrom(""); setDateTo("");
  };

  const activeChips: { label: string; onClear: () => void }[] = [];
  if (statusFilter !== "all") activeChips.push({ label: `Status: ${STATUS_META[statusFilter]?.label ?? statusFilter}`, onClear: () => setStatusFilter("all") });
  if (categoryFilter !== "all") activeChips.push({ label: `Categoria: ${CATEGORY_LABEL[categoryFilter] ?? categoryFilter}`, onClear: () => setCategoryFilter("all") });
  if (deliveryFilter !== "all") activeChips.push({ label: `Entrega: ${deliveryFilter === "pickup" ? "Retirada" : "Correio"}`, onClear: () => setDeliveryFilter("all") });
  if (dropFilter !== "all") activeChips.push({ label: `Produto: ${dropOptions.find(([id]) => id === dropFilter)?.[1] ?? dropFilter}`, onClear: () => setDropFilter("all") });
  if (dateFrom) activeChips.push({ label: `De: ${dateFrom}`, onClear: () => setDateFrom("") });
  if (dateTo) activeChips.push({ label: `Até: ${dateTo}`, onClear: () => setDateTo("") });
  if (search) activeChips.push({ label: `Busca: "${search}"`, onClear: () => setSearch("") });

  const exportCSV = () => {
    downloadCSV(`financeiro-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        data: new Date(r.created_at).toLocaleString("pt-BR"),
        produto: r.drops?.title ?? "",
        categoria: CATEGORY_LABEL[r.drops?.product_category ?? "other"] ?? "",
        tamanho: r.size ?? "",
        entrega: r.delivery_method === "pickup" ? "Retirada" : r.delivery_method === "shipping" ? "Correio" : "",
        valor: centsToMoneyInput(r.amount_cents ?? 0),
        status: STATUS_META[r.status]?.label ?? r.status,
        comprador: r.full_name,
        email: r.email,
        telefone: r.phone ?? "",
        usuario_vinculado: r.linked_user_id ?? r.user_id ?? "",
        endereco: [r.address_street, r.address_number, r.address_district, r.address_city, r.address_state, r.address_zip].filter(Boolean).join(", "),
      })));
  };

  return (
    <DashboardShell title="Financeiro" description="Pedidos, receita e status de vendas dos drops.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Receita confirmada" value={centsToMoneyInput(kpis.revenue)} icon={<DollarSign className="h-4 w-4" />} accent="text-emerald-400" />
        <KpiCard label="Pendente" value={centsToMoneyInput(kpis.pending)} icon={<DollarSign className="h-4 w-4" />} accent="text-yellow-500" />
        <KpiCard label="Pedidos" value={String(kpis.orders)} icon={<PackageCheck className="h-4 w-4" />} accent="text-primary" />
        <KpiCard label="Ticket médio" value={centsToMoneyInput(kpis.avg)} icon={<DollarSign className="h-4 w-4" />} accent="text-secondary" />
      </div>

      {/* Filtros */}
      <div className="glass rounded-xl p-3 mb-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar (nome/email/telefone)</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="w-36">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Label className="text-xs">Entrega</Label>
            <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pickup">Retirada</SelectItem>
                <SelectItem value="shipping">Correio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <Label className="text-xs">Produto</Label>
            <Select value={dropFilter} onValueChange={setDropFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {dropOptions.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3 w-3 mr-1" /> CSV</Button>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center border-t border-border/30 pt-2">
            <Filter className="h-3 w-3 text-muted-foreground" />
            {activeChips.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[10px] gap-1 pr-1">
                {c.label}
                <button type="button" onClick={c.onClear} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearFilters}>Limpar tudo</Button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="glass rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border/40 text-muted-foreground">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Produto</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Tam.</th>
              <th className="text-left p-2">Entrega</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Comprador</th>
              <th className="text-left p-2">Usuário</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhum pedido encontrado.</td></tr>}
            {filtered.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.pending;
              return (
                <tr key={r.id} className="border-b border-border/20 hover:bg-muted/10">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="p-2">{r.drops?.title ?? "—"}</td>
                  <td className="p-2">{CATEGORY_LABEL[r.drops?.product_category ?? "other"]}</td>
                  <td className="p-2">{r.size ?? "—"}</td>
                  <td className="p-2">
                    {r.delivery_method === "shipping" ? <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> Correio</span>
                      : r.delivery_method === "pickup" ? <span className="inline-flex items-center gap-1"><PackageCheck className="h-3 w-3" /> Retirada</span>
                      : "—"}
                  </td>
                  <td className="p-2 text-right font-mono">{centsToMoneyInput(r.amount_cents ?? 0)}</td>
                  <td className="p-2">
                    <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
                      <SelectTrigger className={`h-7 text-[10px] w-28 border ${meta.className}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <div className="font-semibold">{r.full_name}</div>
                    <div className="text-muted-foreground">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                  </td>
                  <td className="p-2">
                    {r.linked_user_id || r.user_id
                      ? <Badge variant="outline" className="text-[10px] gap-1"><Link2 className="h-3 w-3" /> Vinculado</Badge>
                      : <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setDetail(r)}>Ver</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setLinkFor(r)}><Link2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detalhe */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Pedido — {detail.drops?.title}</DialogTitle>
                <DialogDescription>{new Date(detail.created_at).toLocaleString("pt-BR")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <Row2 label="Comprador" value={detail.full_name} />
                <Row2 label="Email" value={detail.email} />
                <Row2 label="Telefone" value={detail.phone ?? "—"} />
                <Row2 label="Tamanho" value={detail.size ?? "—"} />
                <Row2 label="Entrega" value={detail.delivery_method === "shipping" ? "Correio" : detail.delivery_method === "pickup" ? "Retirada" : "—"} />
                {detail.delivery_method === "shipping" && (
                  <Row2 label="Endereço" value={[detail.address_street, detail.address_number, detail.address_complement, detail.address_district, detail.address_city, detail.address_state, detail.address_zip].filter(Boolean).join(", ")} />
                )}
                <Row2 label="Valor" value={centsToMoneyInput(detail.amount_cents ?? 0)} />
                <Row2 label="Status" value={STATUS_META[detail.status]?.label ?? detail.status} />
                {detail.note && <Row2 label="Observação" value={detail.note} />}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Vincular usuário */}
      <LinkUserDialog row={linkFor} onClose={() => setLinkFor(null)} onDone={() => qc.invalidateQueries({ queryKey: ["financeiro-orders"] })} />
    </DashboardShell>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className={`flex items-center gap-1.5 text-[10px] tracking-widest ${accent}`}>{icon} {label.toUpperCase()}</div>
      <div className="text-lg font-black mt-1">{value}</div>
    </div>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <div className="w-24 text-muted-foreground tracking-widest text-[10px] uppercase pt-0.5">{label}</div>
      <div className="flex-1 font-medium break-words">{value}</div>
    </div>
  );
}

function LinkUserDialog({ row, onClose, onDone }: { row: Row | null; onClose: () => void; onDone: () => void }) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { if (row) { setTerm(row.email); setSelected(row.linked_user_id ?? row.user_id ?? null); } }, [row]);

  const { data: results = [] } = useQuery({
    queryKey: ["profile-search", term],
    enabled: !!row && term.trim().length >= 2,
    queryFn: async () => {
      const t = `%${term.trim()}%`;
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,email")
        .or(`display_name.ilike.${t},email.ilike.${t}`)
        .limit(10);
      return data ?? [];
    },
  });

  const save = async () => {
    if (!row) return;
    const { error } = await supabase.from("drop_interests").update({ linked_user_id: selected } as any).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Usuário vinculado");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular pedido a um usuário</DialogTitle>
          <DialogDescription>Busque por nome ou email do usuário cadastrado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Digite nome ou email…" value={term} onChange={(e) => setTerm(e.target.value)} />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {results.map((p: any) => (
              <button
                key={p.user_id}
                type="button"
                onClick={() => setSelected(p.user_id)}
                className={`w-full text-left p-2 rounded border text-xs ${selected === p.user_id ? "border-primary bg-primary/10" : "border-border/40 hover:bg-muted/20"}`}
              >
                <div className="font-semibold">{p.display_name ?? "(sem nome)"}</div>
                <div className="text-muted-foreground">{p.email}</div>
              </button>
            ))}
            {term.length >= 2 && results.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado</p>}
          </div>
          <div className="flex gap-2 justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => { setSelected(null); }}>Desvincular</Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={save}>Salvar</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}