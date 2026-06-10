import { useEffect, useState } from "react";
import { Calendar, ExternalLink, Heart, MapPin, Mic2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function EventDetailDialog({ event, open, onOpenChange }: { event: any | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, isAuthenticated } = useAuth();
  const [interested, setInterested] = useState(false);
  const [waitlistPos, setWaitlistPos] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event || !user) { setInterested(false); return; }
    supabase.from("user_event_interests").select("id").eq("user_id", user.id).eq("event_id", event.id).maybeSingle()
      .then(({ data }) => setInterested(!!data));
    supabase.from("event_waitlist" as any).select("position").eq("user_id", user.id).eq("event_id", event.id).maybeSingle()
      .then(({ data }: any) => setWaitlistPos(data?.position ?? null));
  }, [event, user]);

  if (!event) return null;
  const isUrl = event.location_or_link && /^https?:\/\//i.test(event.location_or_link);
  const onlineLink = event.online_link || (isUrl ? event.location_or_link : null);
  const place = event.address || (!isUrl ? event.location_or_link : null);
  const speakers: any[] = Array.isArray(event.speakers) ? event.speakers : [];

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    if (interested) {
      const { error } = await supabase.from("user_event_interests").delete().eq("user_id", user.id).eq("event_id", event.id);
      if (error) toast.error(error.message); else { setInterested(false); toast.success("Inscrição removida"); }
    } else if (waitlistPos) {
      const { error } = await supabase.from("event_waitlist" as any).delete().eq("user_id", user.id).eq("event_id", event.id);
      if (error) toast.error(error.message); else { setWaitlistPos(null); toast.success("Saiu da lista de espera"); }
    } else {
      const { data, error }: any = await supabase.rpc("register_event_interest" as any, { _event_id: event.id });
      if (error) toast.error(error.message);
      else if (data?.status === "waitlist") { setWaitlistPos(data.position); toast.info(`Vagas esgotadas. Você entrou na lista de espera (#${data.position}).`); }
      else { setInterested(true); toast.success("Você se inscreveu!"); }
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Calendar className="h-5 w-5 text-primary" /> {event.name}
          </DialogTitle>
          <DialogDescription>
            {new Date(event.event_date).toLocaleDateString("pt-BR", { dateStyle: "full" })}
            {event.event_time ? ` • ${event.event_time}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {event.modality && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{event.modality}</span>
          )}
          {event.category && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">{event.category}</span>
          )}
          {event.source && (
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${event.source === "comunidade" ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}`}>
              {event.source === "comunidade" ? "Comunidade" : "Terceiros"}
            </span>
          )}
          {event.max_attendees && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {event.max_attendees} vagas
            </span>
          )}
        </div>

        {event.theme && <div className="text-sm"><span className="font-semibold">Tema:</span> <span className="text-primary">{event.theme}</span></div>}

        {place && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{place}</span>
          </div>
        )}
        {onlineLink && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ExternalLink className="h-4 w-4 shrink-0" />
            <a href={onlineLink} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline break-all">{onlineLink}</a>
          </div>
        )}

        {event.description && (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{event.description}</div>
        )}

        {speakers.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Mic2 className="h-4 w-4 text-primary" /> Palestrantes</div>
            <ul className="space-y-2">
              {speakers.map((s, i) => (
                <li key={i} className="glass rounded p-3 border border-border/40">
                  <div className="font-medium text-sm">{s.name}</div>
                  {s.topic && <div className="text-xs text-primary">{s.topic}</div>}
                  {s.bio && <div className="text-xs text-muted-foreground mt-1">{s.bio}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
          {onlineLink && (
            <a href={onlineLink} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[180px]">
              <Button variant="neon" className="w-full"><ExternalLink className="h-4 w-4 mr-2" /> Acessar evento</Button>
            </a>
          )}
          {isAuthenticated ? (
            <Button variant={interested ? "default" : waitlistPos ? "secondary" : "outline"} onClick={toggle} disabled={busy}>
              <Heart className={`h-4 w-4 mr-2 ${interested ? "fill-current" : ""}`} />
              {interested ? "Inscrito" : waitlistPos ? `Lista de espera #${waitlistPos}` : "Tenho interesse"}
            </Button>
          ) : (
            <Link to="/login"><Button variant="outline"><Heart className="h-4 w-4 mr-2" /> Entrar para se inscrever</Button></Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}