import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Filter, X } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/dashboard/logs")({ component: LogsPage });

type Log = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string | null;
  role?: string | null;
};

function LogsPage() {
  const navigate = useNavigate();
  const { isAdmin, rolesReady } = useDashboardRoles();
  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Log | null>(null);
  const PAGE_SIZE = 50;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, entityFilter, userFilter, search, from, to, page],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (entityFilter !== "all") q = q.eq("entity", entityFilter);
      if (userFilter.trim()) q = q.ilike("user_name", `%${userFilter.trim()}%`);
      if (search.trim()) q = q.ilike("description", `%${search.trim()}%`);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Log[];
    },
  });

  // distintos para os selects (1000 últimos)
  const { data: distincts } = useQuery({
    queryKey: ["audit-distincts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("action,entity").order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      const actions = new Set<string>(); const entities = new Set<string>();
      (data ?? []).forEach((r: any) => { actions.add(r.action); entities.add(r.entity); });
      return { actions: Array.from(actions).sort(), entities: Array.from(entities).sort() };
    },
  });

  const clearFilters = () => {
    setActionFilter("all"); setEntityFilter("all"); setUserFilter(""); setSearch(""); setFrom(""); setTo(""); setPage(0);
  };

  const exportCsv = async () => {
    let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5000);
    if (actionFilter !== "all") q = q.eq("action", actionFilter);
    if (entityFilter !== "all") q = q.eq("entity", entityFilter);
    if (userFilter.trim()) q = q.ilike("user_name", `%${userFilter.trim()}%`);
    if (search.trim()) q = q.ilike("description", `%${search.trim()}%`);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", `${to}T23:59:59`);
    const { data, error } = await q;
    if (error) return;
    downloadCSV(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
      (data ?? []).map((l: any) => ({
        data: new Date(l.created_at).toLocaleString("pt-BR"),
        usuario: l.user_name ?? "",
        acao: l.action,
        entidade: l.entity,
        entity_id: l.entity_id ?? "",
        descricao: l.description ?? "",
      })));
  };

  return (
    <DashboardShell title="Logs de Auditoria" description="Filtre, inspecione detalhes e exporte como CSV.">
      <div className="glass rounded-xl border border-primary/20 p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground/70">
          <Filter className="h-3 w-3" /> FILTROS
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <Input placeholder="Usuário…" value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(0); }} />
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent className="max-h-72"><SelectItem value="all">Todas as ações</SelectItem>
              {distincts?.actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent className="max-h-72"><SelectItem value="all">Todas as entidades</SelectItem>
              {distincts?.entities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
          <Input placeholder="Buscar descrição…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{logs.length} resultado(s) nesta página</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={clearFilters}><X className="h-3 w-3 mr-1" /> Limpar</Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3 w-3 mr-1" /> Exportar CSV</Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl border border-primary/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>}
            {!isLoading && logs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum log com esses filtros.</TableCell></TableRow>}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-xs">{l.user_name ?? "—"}</TableCell>
                <TableCell className="text-xs"><Badge variant="outline" className="font-bold">{l.action}</Badge></TableCell>
                <TableCell className="text-xs">{l.entity}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md truncate">{l.description ?? "—"}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setDetail(l)}><Eye className="h-3 w-3" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Anterior</Button>
        <span className="text-xs text-muted-foreground">Página {page + 1}</span>
        <Button size="sm" variant="ghost" disabled={logs.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Próxima →</Button>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalhes do log</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <Row k="Quando" v={new Date(detail.created_at).toLocaleString("pt-BR")} />
              <Row k="Usuário" v={detail.user_name ?? "—"} />
              <Row k="User ID" v={detail.user_id ?? "—"} mono />
              <Row k="Ação" v={detail.action} />
              <Row k="Entidade" v={detail.entity} />
              <Row k="Entity ID" v={detail.entity_id ?? "—"} mono />
              <div>
                <div className="text-[10px] tracking-widest text-muted-foreground/70 mb-1">DESCRIÇÃO</div>
                <div className="rounded bg-muted/30 p-2 text-xs whitespace-pre-wrap">{detail.description ?? "—"}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-[10px] tracking-widest text-muted-foreground/70 w-24 pt-1">{k.toUpperCase()}</div>
      <div className={`flex-1 ${mono ? "font-mono text-xs" : "text-sm"}`}>{v}</div>
    </div>
  );
}