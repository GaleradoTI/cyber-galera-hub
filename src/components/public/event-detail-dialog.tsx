import { useEffect, useState } from "react";
import { Calendar, ExternalLink, Heart, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function EventDetailDialog({ event, open, onOpenChange }: { event: any | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, isAuthenticated } = useAuth();
  const [interested, setInterested] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event || !user) { setInterested(false); return; }
    supabase.from("user_event_interests").select("id").eq("user_id", user.id).eq("event_id", event.id).maybeSingle()
      .then(({ data }) => setInterested(!!data));
  }, [event, user]);

  if (!event) return null;
  const isUrl = event.location_or_link && /^https?:\/\//i.test(event.location_or_link);

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    if (interested) {
      const { error } = await supabase.from("user_event_interests").delete().eq("user_id", user.id).eq("event_id", event.id);
      if (error) toast.error(error.message); else { setInterested(false); toast.success("Inscrição removida"); }
    } else {
      const { error } = await supabase.from("user_event_interests").insert({ user_id: user.id, event_id: event.id });
      if (error) toast.error(error.message); else { setInterested(true); toast.success("Você se inscreveu!"); }
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
        </div>

        {event.location_or_link && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            {isUrl ? (
              <a href={event.location_or_link} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline break-all">
                {event.location_or_link}
              </a>
            ) : (
              <span>{event.location_or_link}</span>
            )}
          </div>
        )}

        {event.description && (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{event.description}</div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
          {isUrl && (
            <a href={event.location_or_link} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[180px]">
              <Button variant="neon" className="w-full"><ExternalLink className="h-4 w-4 mr-2" /> Acessar evento</Button>
            </a>
          )}
          {isAuthenticated ? (
            <Button variant={interested ? "default" : "outline"} onClick={toggle} disabled={busy}>
              <Heart className={`h-4 w-4 mr-2 ${interested ? "fill-current" : ""}`} />
              {interested ? "Inscrito" : "Tenho interesse"}
            </Button>
          ) : (
            <Link to="/login"><Button variant="outline"><Heart className="h-4 w-4 mr-2" /> Entrar para se inscrever</Button></Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}