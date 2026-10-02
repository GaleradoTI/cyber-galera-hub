import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, ExternalLink, Hourglass, MapPin, Navigation, Ticket, Users, Video, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/public-layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownView } from "@/components/ui/markdown-editor";
import { ScheduleTimeline } from "@/components/events/schedule";
import { QrCode } from "@/components/events/qr-code";
import { EventQA } from "@/components/public/event-qa";
import { formatDateOnly } from "@/lib/utils";
import { REG_STATUS, hhmm, mapsUrl, parseSchedule, type RegistrationStatus } from "@/lib/events";

export const Route = createFileRoute("/eventos/$id")({
  head: () => ({
    meta: [
      { title: "Evento — GALERA DO T.I." },
      { name: "description", content: "Programação, local e inscrição do evento da comunidade Galera do TI." },
      { property: "og:title", content: "Evento — GALERA DO T.I." },
      { property: "og:description", content: "Programação, local e inscrição do evento da comunidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventPage,
});

const MODALITY: Record<string, string> = { online: "Online", presencial: "Presencial", hibrido: "Híbrido" };

function EventPage() {
  const { id } = Route.useParams();
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: ev, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      return data as any;
    },
  });

  const { data: reg } = useQuery({
    queryKey: ["my-registration", id, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase.from("event_registrations" as any) as any).select("*").eq("event_id", id).eq("user_id", user!.id).maybeSingle();
      return data as any;
    },
  });

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).some((r: any) => r.role === "ADMIN" || r.role === "SUPER_ADMIN");
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-registration", id] });

  const register = async () => {
    setBusy(true);
    const { data, error }: any = await supabase.rpc("register_for_event" as any, { _event_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    const st = data?.status as RegistrationStatus;
    toast.success(st === "approved" ? "Presença confirmada! Seu ingresso está pronto." : st === "waitlist" ? "Vagas esgotadas — você entrou na lista de espera." : "Pedido enviado! Aguarde a aprovação da organização.");
    refresh();
  };
  const cancel = async () => {
    if (!confirm("Cancelar sua presença neste evento?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_event_registration" as any, { _event_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Presença cancelada");
    refresh();
  };

  if (isLoading) return <PublicLayout><div className="container mx-auto px-4 py-20 text-muted-foreground">Carregando…</div></PublicLayout>;
  if (!ev || ev.status !== "publicado") {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Evento não encontrado.</p>
          <Link to="/eventos" className="text-primary underline mt-4 inline-block">Ver todos os eventos</Link>
        </div>
      </PublicLayout>
    );
  }

  const isUrl = ev.location_or_link && /^https?:\/\//i.test(ev.location_or_link);
  const onlineLink = ev.online_link || (isUrl ? ev.location_or_link : null);
  const place = ev.address || (!isUrl ? ev.location_or_link : null);
  const schedule = parseSchedule(ev.schedule);
  const speakers: any[] = Array.isArray(ev.speakers) ? ev.speakers : [];
  const active = reg && !["cancelled", "rejected"].includes(reg.status);
  const status = reg?.status as RegistrationStatus | undefined;
  const isPast = ev.event_date < new Date().toISOString().slice(0, 10);

  return (
    <PublicLayout>
      <div className="relative">
        {ev.cover_url ? (
          <div className="h-56 md:h-80 w-full overflow-hidden">
            <img src={ev.cover_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </div>
        ) : <div className="h-24" />}
      </div>

      <section className={`container mx-auto px-4 pb-16 relative ${ev.cover_url ? "-mt-28" : ""}`}>
        <Link to="/eventos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4" /> Eventos
        </Link>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge>{MODALITY[ev.modality] ?? ev.modality}</Badge>
          {ev.category && <Badge variant="outline">{ev.category}</Badge>}
          {isPast && <Badge variant="secondary">Encerrado</Badge>}
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight max-w-4xl">{ev.name}</h1>
        {ev.theme && <p className="text-lg text-primary mt-2">{ev.theme}</p>}

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 mt-8 items-start">
          <div className="space-y-8 min-w-0">
            <div className="grid sm:grid-cols-2 gap-3">
              <InfoTile icon={<CalendarDays className="h-5 w-5" />} label="Data" value={formatDateOnly(ev.event_date)} />
              <InfoTile icon={<Clock className="h-5 w-5" />} label="Horário" value={ev.event_time ? `${hhmm(ev.event_time)}${ev.end_time ? ` às ${hhmm(ev.end_time)}` : ""}` : "A definir"} />
              {place && (
                <div className="glass rounded-xl p-4 border border-border/40 sm:col-span-2 flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Endereço</div>
                    <div className="font-medium break-words">{place}</div>
                  </div>
                  <a href={mapsUrl(place)} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Navigation className="h-3.5 w-3.5 mr-1" /> Mapa</Button>
                  </a>
                </div>
              )}
              {ev.max_attendees && <InfoTile icon={<Users className="h-5 w-5" />} label="Vagas" value={`${ev.max_attendees} lugares`} />}
              {onlineLink && <InfoTile icon={<Video className="h-5 w-5" />} label="Transmissão" value={isAuthenticated ? "Link disponível" : "Entre para ver o link"} />}
            </div>

            {schedule.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Programação</h2>
                <div className="glass rounded-xl p-5 border border-border/40"><ScheduleTimeline items={schedule} /></div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold mb-3">Sobre o evento</h2>
              <div className="prose prose-invert max-w-none"><MarkdownView>{ev.description ?? ""}</MarkdownView></div>
            </div>

            {speakers.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-3">Palestrantes</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {speakers.map((s, i) => (
                    <div key={i} className="glass rounded-xl p-4 border border-border/40">
                      <div className="font-semibold">{s.name}</div>
                      {s.topic && <div className="text-sm text-primary">{s.topic}</div>}
                      {s.bio && <p className="text-xs text-muted-foreground mt-1">{s.bio}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <EventQA eventId={ev.id} isAdmin={isAdmin} />
          </div>

          <aside className="lg:sticky lg:top-24 glass rounded-2xl p-5 border border-primary/30 space-y-4">
            <div className="flex items-center gap-2 font-bold"><Ticket className="h-5 w-5 text-primary" /> Sua presença</div>
            {!isAuthenticated ? (
              <>
                <p className="text-sm text-muted-foreground">Entre na sua conta para confirmar presença e receber seu ingresso com QR Code.</p>
                <Link to="/login" search={{ redirect: `/eventos/${id}` } as any}><Button variant="neon" className="w-full">Entrar para confirmar</Button></Link>
              </>
            ) : !active ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {ev.requires_approval ? "A organização analisa os pedidos e libera o ingresso para quem for aprovado." : "Confirme e receba seu ingresso na hora."}
                </p>
                {status === "rejected" && <Badge variant="destructive">Pedido anterior não aprovado</Badge>}
                <Button variant="neon" className="w-full" disabled={busy || isPast} onClick={register}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> {isPast ? "Evento encerrado" : "Quero ir"}
                </Button>
              </>
            ) : (
              <>
                <Badge variant={REG_STATUS[status!].variant} className="text-sm">
                  {status === "pending" && <Hourglass className="h-3.5 w-3.5 mr-1" />}
                  {REG_STATUS[status!].label}
                </Badge>
                {status === "approved" ? (
                  <div className="text-center space-y-2">
                    <QrCode value={reg.ticket_code} size={180} />
                    <div className="font-mono text-lg font-bold tracking-widest">{reg.ticket_code}</div>
                    <p className="text-xs text-muted-foreground">Apresente este QR Code ou o código na entrada.</p>
                    {reg.checked_in_at && <Badge><CheckCircle2 className="h-3 w-3 mr-1" /> Check-in realizado</Badge>}
                  </div>
                ) : status === "pending" ? (
                  <p className="text-sm text-muted-foreground">Recebemos seu pedido. Você será notificado quando for aprovado.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Te avisaremos se uma vaga for liberada.</p>
                )}
                {onlineLink && status === "approved" && (
                  <a href={onlineLink} target="_blank" rel="noopener noreferrer"><Button variant="outline" className="w-full"><ExternalLink className="h-4 w-4 mr-2" /> Acessar transmissão</Button></a>
                )}
                {!reg.checked_in_at && (
                  <Button variant="ghost" size="sm" className="w-full" disabled={busy} onClick={cancel}><XCircle className="h-4 w-4 mr-2" /> Cancelar presença</Button>
                )}
              </>
            )}
          </aside>
        </div>
      </section>
    </PublicLayout>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-border/40 flex items-center gap-3">
      <span className="text-primary">{icon}</span>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
