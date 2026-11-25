import { CheckinPanel } from "@/components/events/checkin-panel";
import { LoadingState, EmptyState } from "@/components/brand/ui-kit";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CheckCircle2, Download, IdCard, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles, useAmbassadorCan } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCSV } from "@/lib/csv";
import { formatDateOnly } from "@/lib/utils";
import { REG_STATUS, EVENT_COLUMNS, type RegistrationStatus } from "@/lib/events";

export const Route = createFileRoute("/dashboard/evento-inscricoes/$id")({
  head: () => ({ meta: [{ title: "Inscrições e check-in — Galera do TI" }, { name: "description", content: "Controle de inscrições e presença dos eventos da Galera do TI." }, { property: "og:title", content: "Inscrições e check-in — Galera do TI" }, { property: "og:description", content: "Gestão dos participantes e leitura de ingressos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: InscricoesPage,
});

type Reg = { id: string; user_id: string; status: RegistrationStatus; ticket_code: string; created_at: string; checked_in_at: string | null; profile?: any };

function InscricoesPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useDashboardRoles();
  const { can } = useAmbassadorCan();
  const canDecide = can("eventos", "inscricoes");
  const canScan = can("eventos", "checkin");
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const { data: ev } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => (await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle()).data as any,
  });

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["event-regs", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_registrations" as any) as any).select("*").eq("event_id", id).order("created_at");
      if (error) throw error;
      const rows = (data ?? []) as Reg[];
      const { data: profs, error: peopleError } = await (supabase as any).rpc("get_event_participants", { _event_id: id });
      if (peopleError) throw peopleError;
      const map = new Map(((profs ?? []) as any[]).map((p) => [p.user_id, p]));
      return rows.map((r) => ({ ...r, profile: map.get(r.user_id) }));
    },
  });

  // Realtime-ish: refresh a cada 15s para o contador de check-in
  useEffect(() => {
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["event-regs", id] }), 15000);
    return () => clearInterval(t);
  }, [id, qc]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: regs.length, checked: 0 };
    regs.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; if (r.checked_in_at) c.checked++; });
    return c;
  }, [regs]);

  const list = regs.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    const t = q.toLowerCase();
    return !t || r.profile?.nickname?.includes(t.replace(/^@/, "")) || r.profile?.display_name?.toLowerCase().includes(t) || r.profile?.email?.toLowerCase().includes(t) || r.ticket_code.toLowerCase().includes(t);
  });

  const decide = async (ids: string[], status: RegistrationStatus) => {
    if (!ids.length) return;
    const { error } = await supabase.rpc("decide_registration" as any, { _ids: ids, _status: status });
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} inscrição(ões) atualizada(s)`);
    setSel(new Set());
    qc.invalidateQueries({ queryKey: ["event-regs", id] });
  };

  const exportCsv = () =>
    downloadCSV(`inscricoes-${ev?.name ?? id}.csv`, list.map((r) => ({
      nome: r.profile?.display_name ?? "", nick: r.profile?.nickname ?? "", email: r.profile?.email ?? "", telefone: r.profile?.phone ?? "",
      status: REG_STATUS[r.status].label, codigo: r.ticket_code, inscrito_em: r.created_at, checkin: r.checked_in_at ?? "",
    })));

  if (!isAdmin && !canDecide && !canScan) return <DashboardShell title="Inscrições"><p className="text-muted-foreground">Você não tem acesso às inscrições ou ao check-in deste evento.</p></DashboardShell>;

  return (
    <DashboardShell title={ev?.name ?? "Inscrições"} description={ev ? `${formatDateOnly(ev.event_date)} · inscrições, check-in e crachás` : undefined}>
      <Link to="/dashboard/eventos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"><ArrowLeft className="h-4 w-4" /> Eventos</Link>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Pedidos" value={counts.all} />
        <Stat label="Pendentes" value={counts.pending ?? 0} />
        <Stat label="Aprovados" value={`${counts.approved ?? 0}${ev?.max_attendees ? ` / ${ev.max_attendees}` : ""}`} />
        <Stat label="Presentes" value={`${counts.checked} / ${counts.approved ?? 0}`} />
      </div>

      <Tabs key={canDecide ? "gestao" : "portaria"} defaultValue={canDecide ? "list" : "checkin"}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">Inscrições</TabsTrigger>
          {canScan && <TabsTrigger value="checkin">Check-in · Ler QR Code</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar nome, e-mail ou código" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({counts.all})</SelectItem>
                {(Object.keys(REG_STATUS) as RegistrationStatus[]).map((s) => <SelectItem key={s} value={s}>{REG_STATUS[s].label} ({counts[s] ?? 0})</SelectItem>)}
              </SelectContent>
            </Select>
            {canDecide && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>}
            {canDecide && <Link to="/dashboard/evento-crachas/$id" params={{ id }}><Button variant="outline" className="w-full"><IdCard className="h-4 w-4 mr-1" /> Crachás</Button></Link>}
          </div>

          {sel.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 glass rounded-lg p-2 border border-primary/30">
              <span className="text-sm px-2">{sel.size} selecionado(s)</span>
              <Button size="sm" onClick={() => decide([...sel], "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar</Button>
              <Button size="sm" variant="destructive" onClick={() => decide([...sel], "rejected")}><Ban className="h-3.5 w-3.5 mr-1" /> Recusar</Button>
            </div>
          )}

          {isLoading && <LoadingState />}
          {!isLoading && list.length === 0 && <EmptyState title="Nenhuma inscrição" />}
          <div className="grid gap-2">
            {list.map((r) => (
              <div key={r.id} className="glass rounded-xl p-3 border border-border/40 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {canDecide && <Checkbox checked={sel.has(r.id)} onCheckedChange={(v) => { const n = new Set(sel); v ? n.add(r.id) : n.delete(r.id); setSel(n); }} />}
                  {r.profile?.avatar_url ? <img src={r.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-muted" />}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.profile?.display_name ?? "Usuário"} {r.profile?.nickname && <span className="text-secondary text-sm">@{r.profile.nickname}</span>}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.profile?.email ? `${r.profile.email} · ` : ""}<span className="font-mono">{r.ticket_code}</span></div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant={REG_STATUS[r.status].variant}>{REG_STATUS[r.status].label}</Badge>
                  {r.checked_in_at && <Badge><UserCheck className="h-3 w-3 mr-1" /> Presente</Badge>}
                  {canDecide && r.status !== "approved" && r.status !== "cancelled" && !r.checked_in_at && <Button size="sm" variant="outline" onClick={() => decide([r.id], "approved")}>Aprovar</Button>}
                  {canDecide && r.status !== "rejected" && r.status !== "cancelled" && !r.checked_in_at && <Button size="sm" variant="ghost" onClick={() => decide([r.id], "rejected")}>Recusar</Button>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {canScan && <TabsContent value="checkin"><CheckinPanel eventId={id} people={regs} onDone={() => { qc.invalidateQueries({ queryKey: ["event-regs", id] }); qc.invalidateQueries({ queryKey: ["my-registrations"] }); }} /></TabsContent>}
      </Tabs>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="glass rounded-xl p-4 border border-border/40"><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-2xl font-black mt-1">{value}</div></div>;
}
