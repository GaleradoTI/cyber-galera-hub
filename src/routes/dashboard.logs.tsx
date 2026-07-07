import { Fragment, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Download, Eye, Filter, X } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

const searchSchema = z.object({
  action: fallback(z.string(), "all").default("all"),
  entity: fallback(z.string(), "all").default("all"),
  user: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(0), 0).default(0),
  sortBy: fallback(z.enum(["created_at", "action", "entity", "user_name"]), "created_at").default("created_at"),
  sortDir: fallback(z.enum(["asc", "desc"]), "desc").default("desc"),
});

export const Route = createFileRoute("/dashboard/logs")({
  component: LogsPage,
  validateSearch: zodValidator(searchSchema),
});

type Log = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string | null;
};

const PAGE_SIZE = 50;

function LogsPage() {
  const navigate = useNavigate();
  const { isAdmin, rolesReady } = useDashboardRoles();
  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { action: actionFilter, entity: entityFilter, user: userFilter, q: search, from, to, page, sortBy, sortDir } = Route.useSearch();
  const update = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({
      to: "/dashboard/logs",
      search: (prev: any) => ({ ...prev, ...patch, page: "page" in patch ? patch.page ?? 0 : 0 }),
    });
  const setPage = (p: number) =>
    navigate({ to: "/dashboard/logs", search: (prev: any) => ({ ...prev, page: p }) });
  const toggleSort = (col: "created_at" | "action" | "entity" | "user_name") => {
    if (sortBy === col) update({ sortDir: sortDir === "asc" ? "desc" : "asc" });
    else update({ sortBy: col, sortDir: "desc" });
  };
  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col ? (sortDir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-1" /> : <ArrowDown className="inline h-3 w-3 ml-1" />) : null;

  const [detail, setDetail] = useState<Log | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, entityFilter, userFilter, search, from, to, page, sortBy, sortDir],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order(sortBy, { ascending: sortDir === "asc" });
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

  const clearFilters = () =>
    navigate({ to: "/dashboard/logs", search: { action: "all", entity: "all", user: "", q: "", from: "", to: "", page: 0, sortBy: "created_at", sortDir: "desc" } });

  const exportCsv = async () => {
    let q = supabase.from("audit_logs").select("*").order(sortBy, { ascending: sortDir === "asc" }).limit(5000);
    if (actionFilter !== "all") q = q.eq("action", actionFilter);
    if (entityFilter !== "all") q = q.eq("entity", entityFilter);
    if (userFilter.trim()) q = q.ilike("user_name", `%${userFilter.trim()}%`);
    if (search.trim()) q = q.ilike("description", `%${search.trim()}%`);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", `${to}T23:59:59`);
    const { data, error } = await q;
    if (error) return;
    // Buscar contexto por entidade em batches usando o mesmo mapa do EntityContext.
    const ENTITY_MAP: Record<string, { table: string; cols: string; key?: string }> = {
      projects: { table: "projects", cols: "id,name,slug,status,is_public" },
      squads: { table: "squads", cols: "id,name,project_id,recruiting_status" },
      squad_members: { table: "squad_members", cols: "id,squad_id,user_id,role_in_squad" },
      squad_goals: { table: "squad_goals", cols: "id,project_id,squad_id,title,due_date" },
      project_join_requests: { table: "project_join_requests", cols: "id,project_id,squad_id,user_id,status,source" },
      project_posts: { table: "project_posts", cols: "id,project_id,user_id,created_at" },
      events: { table: "events", cols: "id,name,slug,status,approval_status,event_date" },
      jobs: { table: "jobs", cols: "id,title,status" },
      partners: { table: "partners", cols: "id,name,website,is_active" },
      channels: { table: "channels", cols: "id,name,kind,is_active" },
      faqs: { table: "faqs", cols: "id,question,category,is_active" },
      public_site_settings: { table: "public_site_settings", cols: "setting_key,description,updated_at", key: "setting_key" },
      drops: { table: "drops", cols: "id,title,status,price_cents,launch_date" },
      drop_interests: { table: "drop_interests", cols: "id,drop_id,full_name,email" },
      community_profiles: { table: "community_profiles", cols: "id,name,profile_type,is_active" },
      member_feed_posts: { table: "member_feed_posts", cols: "id,author_id,status,created_at" },
    };
    const byEntity = new Map<string, string[]>();
    (data ?? []).forEach((l: any) => {
      if (!l.entity_id || !ENTITY_MAP[l.entity]) return;
      const arr = byEntity.get(l.entity) ?? [];
      arr.push(l.entity_id);
      byEntity.set(l.entity, arr);
    });
    const ctxMap = new Map<string, Record<string, any>>(); // key: `${entity}:${id}`
    await Promise.all(
      Array.from(byEntity.entries()).map(async ([entity, ids]) => {
        const conf = ENTITY_MAP[entity];
        const filterCol = conf.key ?? "id";
        const { data: rows } = await (supabase as any).from(conf.table).select(conf.cols).in(filterCol, Array.from(new Set(ids)));
        (rows ?? []).forEach((r: any) => ctxMap.set(`${entity}:${r[filterCol]}`, r));
      }),
    );
    downloadCSV(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
      (data ?? []).map((l: any) => {
        const ctx = (l.entity_id && ctxMap.get(`${l.entity}:${l.entity_id}`)) || {};
        const ctxCols: Record<string, any> = {};
        Object.entries(ctx).forEach(([k, v]) => {
          ctxCols[`ctx_${k}`] = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
        });
        return {
          data: new Date(l.created_at).toLocaleString("pt-BR"),
          usuario: l.user_name ?? "",
          acao: l.action,
          entidade: l.entity,
          entity_id: l.entity_id ?? "",
          descricao: l.description ?? "",
          ...ctxCols,
        };
      }));
  };

  return (
    <DashboardShell title="Logs de Auditoria" description="Filtros salvos na URL — basta compartilhar/abrir o link para repetir a busca.">
      <div className="glass rounded-xl border border-primary/20 p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground/70">
          <Filter className="h-3 w-3" /> FILTROS
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <Input placeholder="Usuário…" value={userFilter} onChange={(e) => update({ user: e.target.value })} />
          <Select value={actionFilter} onValueChange={(v) => update({ action: v })}>
            <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent className="max-h-72"><SelectItem value="all">Todas as ações</SelectItem>
              {distincts?.actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => update({ entity: v })}>
            <SelectTrigger><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent className="max-h-72"><SelectItem value="all">Todas as entidades</SelectItem>
              {distincts?.entities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => update({ from: e.target.value })} />
          <Input type="date" value={to} onChange={(e) => update({ to: e.target.value })} />
          <Input placeholder="Buscar descrição…" value={search} onChange={(e) => update({ q: e.target.value })} />
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
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>Quando<SortIcon col="created_at" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("user_name")}>Usuário<SortIcon col="user_name" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("action")}>Ação<SortIcon col="action" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("entity")}>Entidade<SortIcon col="entity" /></TableHead>
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
        <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}>← Anterior</Button>
        <span className="text-xs text-muted-foreground">Página {page + 1}</span>
        <Button size="sm" variant="ghost" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>Próxima →</Button>
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
              <EntityContext entity={detail.entity} entityId={detail.entity_id} />
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

/** Mostra os campos relevantes da entidade afetada antes de exportar. */
function EntityContext({ entity, entityId }: { entity: string; entityId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-context", entity, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const map: Record<string, { table: string; cols: string; key?: string }> = {
        projects: { table: "projects", cols: "id,name,slug,status,is_public,description" },
        squads: { table: "squads", cols: "id,name,project_id,recruiting_status,description" },
        squad_members: { table: "squad_members", cols: "id,squad_id,user_id,role_in_squad" },
        squad_goals: { table: "squad_goals", cols: "id,project_id,squad_id,title,due_date" },
        squad_goal_completions: { table: "squad_goal_completions", cols: "id,goal_id,squad_id,completed_by,note" },
        project_join_requests: { table: "project_join_requests", cols: "id,project_id,squad_id,user_id,status,source,message,decision_note" },
        project_posts: { table: "project_posts", cols: "id,project_id,user_id,content,created_at" },
        post_comments: { table: "post_comments", cols: "id,post_id,user_id,content" },
        events: { table: "events", cols: "id,name,slug,status,approval_status,event_date,source" },
        jobs: { table: "jobs", cols: "id,title,status,created_by" },
        job_applications: { table: "job_applications", cols: "id,job_id,user_id,status" },
        partners: { table: "partners", cols: "id,name,website,is_active" },
        channels: { table: "channels", cols: "id,name,kind,url,is_active" },
        faqs: { table: "faqs", cols: "id,question,category,is_active" },
        testimonials: { table: "testimonials", cols: "id,user_id,content,status" },
        public_site_settings: { table: "public_site_settings", cols: "setting_key,description,updated_at", key: "setting_key" },
        site_settings_history: { table: "site_settings_history", cols: "id,setting_key,changed_by_name,created_at" },
        drops: { table: "drops", cols: "id,title,status,price_cents,launch_date" },
        drop_interests: { table: "drop_interests", cols: "id,drop_id,full_name,email,phone" },
        community_profiles: { table: "community_profiles", cols: "id,name,profile_type,is_active" },
        member_feed_posts: { table: "member_feed_posts", cols: "id,author_id,status,created_at" },
        finance_entries: { table: "finance_entries", cols: "id,kind,title,amount_cents,entry_date,status" },
        finance_categories: { table: "finance_categories", cols: "id,name,kind,is_active" },
        finance_tags: { table: "finance_tags", cols: "id,name,is_active" },
      };
      const conf = map[entity];
      if (!conf || !entityId) return null;
      const filterCol = conf.key ?? "id";
      const { data, error } = await (supabase as any)
        .from(conf.table).select(conf.cols).eq(filterCol, entityId).maybeSingle();
      if (error) return { _error: error.message };
      return data;
    },
  });

  if (!entityId) return null;
  return (
    <div>
      <div className="text-[10px] tracking-widest text-muted-foreground/70 mb-1">CONTEXTO ({entity})</div>
      {isLoading ? (
        <div className="rounded bg-muted/20 p-2 text-xs text-muted-foreground">Carregando contexto…</div>
      ) : !data ? (
        <div className="rounded bg-muted/20 p-2 text-xs text-muted-foreground">
          Registro não encontrado (pode ter sido removido) ou entidade sem contexto detalhado.
        </div>
      ) : (data as any)._error ? (
        <div className="rounded bg-destructive/15 p-2 text-xs text-destructive">Falha ao buscar contexto: {(data as any)._error}</div>
      ) : (
        <div className="rounded bg-muted/20 p-2 text-xs grid grid-cols-[140px_1fr] gap-x-2 gap-y-1">
          {Object.entries(data as Record<string, any>).map(([k, v]) => (
            <Fragment key={k}>
              <span className="text-muted-foreground/70 truncate">{k}</span>
              <span className="font-mono break-words">{v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
