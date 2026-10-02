import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Camera, CheckCircle2, Download, IdCard, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCSV } from "@/lib/csv";
import { formatDateOnly } from "@/lib/utils";
import { REG_STATUS, type RegistrationStatus } from "@/lib/events";

export const Route = createFileRoute("/dashboard/evento-inscricoes/$id")({
  head: () => ({ meta: [{ title: "Inscrições do evento — GALERA DO T.I." }, { name: "robots", content: "noindex" }] }),
  component: InscricoesPage,
});

type Reg = { id: string; user_id: string; status: RegistrationStatus; ticket_code: string; created_at: string; checked_in_at: string | null; profile?: any };

function InscricoesPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useDashboardRoles();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const { data: ev } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => (await supabase.from("events").select("*").eq("id", id).maybeSingle()).data as any,
  });

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["event-regs", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_registrations" as any) as any).select("*").eq("event_id", id).order("created_at");
      if (error) throw error;
      const rows = (data ?? []) as Reg[];
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id, display_name, email, avatar_url, work_area, phone").in("user_id", ids) : { data: [] as any[] };
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
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
    return !t || r.profile?.display_name?.toLowerCase().includes(t) || r.profile?.email?.toLowerCase().includes(t) || r.ticket_code.toLowerCase().includes(t);
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
      nome: r.profile?.display_name ?? "", email: r.profile?.email ?? "", telefone: r.profile?.phone ?? "",
      status: REG_STATUS[r.status].label, codigo: r.ticket_code, inscrito_em: r.created_at, checkin: r.checked_in_at ?? "",
    })));

  if (!isAdmin) return <DashboardShell title="Inscrições"><p className="text-muted-foreground">Acesso restrito a administradores.</p></DashboardShell>;

  return (
    <DashboardShell title={ev?.name ?? "Inscrições"} description={ev ? `${formatDateOnly(ev.event_date)} · inscrições, check-in e crachás` : undefined}>
      <Link to="/dashboard/eventos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"><ArrowLeft className="h-4 w-4" /> Eventos</Link>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Pedidos" value={counts.all} />
        <Stat label="Pendentes" value={counts.pending ?? 0} />
        <Stat label="Aprovados" value={`${counts.approved ?? 0}${ev?.max_attendees ? ` / ${ev.max_attendees}` : ""}`} />
        <Stat label="Presentes" value={`${counts.checked} / ${counts.approved ?? 0}`} />
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Inscrições</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
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
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Link to="/dashboard/evento-crachas/$id" params={{ id }}><Button variant="outline" className="w-full"><IdCard className="h-4 w-4 mr-1" /> Crachás</Button></Link>
          </div>

          {sel.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 glass rounded-lg p-2 border border-primary/30">
              <span className="text-sm px-2">{sel.size} selecionado(s)</span>
              <Button size="sm" onClick={() => decide([...sel], "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar</Button>
              <Button size="sm" variant="destructive" onClick={() => decide([...sel], "rejected")}><Ban className="h-3.5 w-3.5 mr-1" /> Recusar</Button>
            </div>
          )}

          {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
          {!isLoading && list.length === 0 && <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma inscrição.</p>}
          <div className="grid gap-2">
            {list.map((r) => (
              <div key={r.id} className="glass rounded-xl p-3 border border-border/40 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox checked={sel.has(r.id)} onCheckedChange={(v) => { const n = new Set(sel); v ? n.add(r.id) : n.delete(r.id); setSel(n); }} />
                  {r.profile?.avatar_url ? <img src={r.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-muted" />}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.profile?.display_name ?? "Usuário"}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.profile?.email} · <span className="font-mono">{r.ticket_code}</span></div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant={REG_STATUS[r.status].variant}>{REG_STATUS[r.status].label}</Badge>
                  {r.checked_in_at && <Badge><UserCheck className="h-3 w-3 mr-1" /> Presente</Badge>}
                  {r.status !== "approved" && r.status !== "cancelled" && <Button size="sm" variant="outline" onClick={() => decide([r.id], "approved")}>Aprovar</Button>}
                  {r.status !== "rejected" && r.status !== "cancelled" && !r.checked_in_at && <Button size="sm" variant="ghost" onClick={() => decide([r.id], "rejected")}>Recusar</Button>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="checkin"><CheckinPanel eventId={id} onDone={() => qc.invalidateQueries({ queryKey: ["event-regs", id] })} /></TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="glass rounded-xl p-4 border border-border/40"><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-2xl font-black mt-1">{value}</div></div>;
}

function CheckinPanel({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const lastRef = useRef<string>("");

  const check = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    const { data, error } = await supabase.rpc("checkin_by_code" as any, { _code: c, _event_id: eventId });
    if (error) return toast.error(error.message);
    setResult({ ...(data as any), code: c });
    setCode("");
    onDone();
  };

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (stopped) return;
      const s = new Html5Qrcode("qr-reader");
      scannerRef.current = s;
      s.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text: string) => {
        if (text === lastRef.current) return;
        lastRef.current = text;
        setTimeout(() => { lastRef.current = ""; }, 3000);
        check(text);
      }, () => {}).catch((e: any) => { toast.error("Não foi possível abrir a câmera: " + (e?.message ?? e)); setScanning(false); });
    });
    return () => { stopped = true; scannerRef.current?.stop?.().catch(() => {}); scannerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const R: Record<string, { text: string; cls: string }> = {
    ok: { text: "Check-in confirmado!", cls: "border-primary bg-primary/10" },
    already: { text: "Já fez check-in", cls: "border-secondary bg-secondary/10" },
    not_approved: { text: "Inscrição não aprovada", cls: "border-destructive bg-destructive/10" },
    not_found: { text: "Código não encontrado neste evento", cls: "border-destructive bg-destructive/10" },
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="glass rounded-xl p-4 border border-border/40 space-y-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); check(code); }}>
          <Input placeholder="GTI-XXXX-XX" className="font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <Button type="submit">Confirmar</Button>
        </form>
        <Button variant={scanning ? "destructive" : "outline"} className="w-full" onClick={() => setScanning((v) => !v)}>
          <Camera className="h-4 w-4 mr-2" /> {scanning ? "Parar câmera" : "Ler QR Code com a câmera"}
        </Button>
        {scanning && <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />}
      </div>
      <div className={`rounded-xl p-6 border-2 min-h-[200px] flex flex-col items-center justify-center text-center ${result ? R[result.result]?.cls : "border-dashed border-border"}`}>
        {!result ? <p className="text-muted-foreground text-sm">Leia um QR Code ou digite o código do ingresso.</p> : (
          <>
            {result.avatar_url && <img src={result.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover mb-3" />}
            <div className="text-xl font-black">{R[result.result]?.text}</div>
            {result.name && <div className="text-lg mt-1">{result.name}</div>}
            {result.work_area && <div className="text-sm text-muted-foreground">{result.work_area}</div>}
            <div className="font-mono text-xs text-muted-foreground mt-2">{result.code}</div>
          </>
        )}
      </div>
    </div>
  );
}
