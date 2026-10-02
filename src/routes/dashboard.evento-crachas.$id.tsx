import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/events/qr-code";
import { formatDateOnly } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/evento-crachas/$id")({
  head: () => ({ meta: [{ title: "Crachás do evento — GALERA DO T.I." }, { name: "robots", content: "noindex" }] }),
  component: CrachasPage,
});

function CrachasPage() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["event-badges", id],
    queryFn: async () => {
      const { data: ev } = await supabase.from("events").select("name, event_date, theme").eq("id", id).maybeSingle();
      const { data: regs } = await (supabase.from("event_registrations" as any) as any).select("user_id, ticket_code").eq("event_id", id).eq("status", "approved");
      const ids = (regs ?? []).map((r: any) => r.user_id);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id, display_name, work_area, avatar_url").in("user_id", ids) : { data: [] as any[] };
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const people = (regs ?? []).map((r: any) => ({ ...r, ...(map.get(r.user_id) ?? {}) })).sort((a: any, b: any) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
      return { ev: ev as any, people };
    },
  });

  return (
    <div className="min-h-screen bg-background p-4 print:p-0 print:bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
        <Link to="/dashboard/evento-inscricoes/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        <div className="text-sm text-muted-foreground">{data?.people.length ?? 0} crachá(s) de participantes aprovados</div>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Imprimir / salvar PDF</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2">
        {data?.people.map((p: any) => (
          <div key={p.ticket_code} className="border-2 border-primary rounded-2xl overflow-hidden flex flex-col break-inside-avoid bg-card text-card-foreground" style={{ minHeight: "11cm" }}>
            <div className="bg-primary text-primary-foreground px-4 py-3">
              <div className="text-[10px] font-bold tracking-[0.3em]">GALERA DO T.I.</div>
              <div className="font-bold leading-tight truncate">{data.ev?.name}</div>
              <div className="text-xs opacity-80">{data.ev?.event_date && formatDateOnly(data.ev.event_date)}</div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 gap-2">
              {p.avatar_url && <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />}
              <div className="text-2xl font-black leading-tight">{p.display_name ?? "Participante"}</div>
              {p.work_area && <div className="text-sm text-muted-foreground">{p.work_area}</div>}
              <QrCode value={p.ticket_code} size={110} />
              <div className="font-mono text-xs tracking-widest">{p.ticket_code}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
