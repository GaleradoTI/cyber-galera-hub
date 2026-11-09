import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, Maximize, MapPin, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QrCode } from "./qr-code";
import { REG_STATUS, hhmm, mapsUrl, type RegistrationStatus } from "@/lib/events";
import { formatDateOnly } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function MemberTickets({ userId }: { userId?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["my-registrations", userId], enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("event_registrations")
        .select("id,status,ticket_code,checked_in_at,events(id,name,event_date,event_time,end_time,address,location_or_link)")
        .eq("user_id", userId).neq("status", "cancelled").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const active = data.find((r) => r.id === expanded);
  return <section className="mb-8 space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="font-bold flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" /> Meus ingressos</h2><Link to="/eventos"><Button variant="outline" size="sm">Ver eventos</Button></Link></div>
    {isLoading && <Skeleton className="h-40 w-full" />}
    {isError && <div role="alert" className="text-sm text-destructive">Não foi possível carregar os ingressos. <Button variant="link" onClick={() => refetch()}>Tentar novamente</Button></div>}
    {!isLoading && !isError && data.length === 0 && <p className="text-sm text-muted-foreground">Você ainda não tem ingressos de eventos internos.</p>}
    <div className="grid gap-4 lg:grid-cols-2">{data.map((r) => {
      const e = r.events; if (!e) return null;
      const status = REG_STATUS[r.status as RegistrationStatus] ?? REG_STATUS.pending;
      return <article key={r.id} className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row gap-4">
        {r.status === "approved" && <div className="shrink-0 self-center"><QrCode value={r.ticket_code} size={144} /><Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded(r.id)}><Maximize className="h-4 w-4 mr-2" /> Abrir ingresso</Button></div>}
        <div className="min-w-0 flex-1 space-y-2"><Badge variant={r.checked_in_at ? "default" : status.variant}>{r.checked_in_at ? "Presença registrada" : status.label}</Badge>
          <Link to="/eventos/$id" params={{ id: e.id }} className="block font-bold break-words hover:text-primary">{e.name}</Link>
          <p className="text-sm text-muted-foreground">{formatDateOnly(e.event_date)} · {hhmm(e.event_time)}{e.end_time ? ` – ${hhmm(e.end_time)}` : ""}</p>
          {e.address && <a href={mapsUrl(e.address)} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-sm text-primary"><MapPin className="h-4 w-4 shrink-0 mt-0.5" />{e.address}</a>}
          {r.status === "approved" && <Button variant="outline" size="sm" className="font-mono" onClick={async () => { try { await navigator.clipboard.writeText(r.ticket_code); toast.success("Código copiado"); } catch { toast.error("Não foi possível copiar"); } }}><Copy className="h-3 w-3 mr-2" />{r.ticket_code}</Button>}
          {r.checked_in_at ? <p className="text-xs text-primary flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{new Date(r.checked_in_at).toLocaleString("pt-BR")}</p> : <p className="text-xs text-muted-foreground">{r.status === "approved" ? "Apresente este ingresso à equipe na entrada." : r.status === "pending" ? "Aguardando aprovação da organização." : r.status === "waitlist" ? "Você receberá um aviso quando uma vaga for liberada." : "Sua inscrição não foi aprovada."}</p>}
        </div>
      </article>;
    })}</div>
    <Dialog open={!!active} onOpenChange={(open) => { if (!open) setExpanded(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{active?.events?.name}</DialogTitle><DialogDescription>Ingresso pessoal · Galera do TI</DialogDescription></DialogHeader>{active && <div className="flex flex-col items-center gap-3"><QrCode value={active.ticket_code} size={240} /><p className="font-mono text-lg font-bold">{active.ticket_code}</p><Badge>{active.checked_in_at ? "Presença registrada" : "Entrada aprovada"}</Badge><p className="text-sm text-muted-foreground">{active.events && formatDateOnly(active.events.event_date)}</p></div>}</DialogContent></Dialog>
  </section>;
}