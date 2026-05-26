import { Calendar, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function EventCard({ event, onClick }: { event: any; onClick?: () => void }) {
  const date = event.event_date
    ? new Date(event.event_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-base group-hover:text-gradient-neon transition">{event.name}</h3>
          {event.category && (
            <p className="text-xs text-muted-foreground mt-0.5">{event.category}</p>
          )}
        </div>
        <Calendar className="h-4 w-4 text-primary shrink-0" />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {event.modality && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
            {event.modality}
          </span>
        )}
        {date && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
            {date}
            {event.event_time ? ` · ${event.event_time}` : ""}
          </span>
        )}
      </div>
      {event.location_or_link && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3 truncate">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.location_or_link}</span>
        </div>
      )}
      {event.description && (
        <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{event.description}</p>
      )}
    </>
  );
  const cls = "glass rounded-xl p-5 hover-glow-cyan block group text-left w-full";
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  }
  return <Link to="/eventos" className={cls}>{inner}</Link>;
}