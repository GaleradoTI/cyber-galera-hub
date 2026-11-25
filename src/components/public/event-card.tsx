import { ArrowRight, Building2, ExternalLink, Laptop, MapPin, Video, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { parseDateOnly, cn } from "@/lib/utils";
import { eventLinks, hhmm, todayBR } from "@/lib/events";

const MODE = {
  online: { label: "Online", icon: Video },
  presencial: { label: "Presencial", icon: Building2 },
  hibrido: { label: "Híbrido", icon: Laptop },
} as const;

/** "Hoje", "Amanhã", "Em 5 dias" ou "Encerrado", comparando só as datas (horário de Brasília). */
export function eventWhen(date?: string | null) {
  if (!date) return null;
  const days = Math.round((Date.parse(date) - Date.parse(todayBR())) / 86_400_000);
  if (days < 0) return { label: "Encerrado", past: true, soon: false };
  if (days === 0) return { label: "É hoje", past: false, soon: true };
  if (days === 1) return { label: "Amanhã", past: false, soon: true };
  return { label: days <= 30 ? `Em ${days} dias` : "Em breve", past: false, soon: days <= 7 };
}

export function EventCard({ event, featured = false }: { event: any; featured?: boolean }) {
  const { place, eventUrl, onlineUrl } = eventLinks(event);
  const date = event.event_date ? parseDateOnly(event.event_date) : null;
  const when = eventWhen(event.event_date);
  const mode = MODE[event.modality as keyof typeof MODE];
  const summary = (event.description ?? "").replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim();

  return (
    <Link to="/eventos/$id" params={{ id: event.id }}
      className={cn("group glass relative flex overflow-hidden rounded-2xl border border-border/40 text-left transition hover:-translate-y-0.5 hover:border-secondary/60 hover-glow-cyan",
        featured ? "flex-col md:flex-row" : "flex-col", when?.past && "opacity-75 hover:opacity-100")}>
      <div className={cn("relative shrink-0 overflow-hidden bg-muted", featured ? "h-56 md:h-auto md:w-1/2 md:min-h-[18rem]" : "h-40")}>
        {event.cover_url
          ? <img src={event.cover_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          : <div aria-hidden className="absolute inset-0 bg-gradient-neon opacity-30" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        {date && (
          <div className="absolute left-3 top-3 w-16 overflow-hidden rounded-xl border border-border/60 bg-background/90 text-center shadow-lg backdrop-blur">
            <p className="bg-gradient-neon py-0.5 text-[10px] font-black uppercase tracking-widest text-background">{date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</p>
            <p className="py-1 text-2xl font-black leading-none tabular-nums">{date.getDate()}</p>
          </div>
        )}
        {when && (
          <span className={cn("absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur",
            when.past ? "border-border bg-background/80 text-muted-foreground" : when.soon ? "border-primary bg-primary/90 text-primary-foreground" : "border-secondary/60 bg-background/80 text-secondary")}>
            {when.label}
          </span>
        )}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-2 p-4", featured && "md:p-6 md:justify-center")}>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary truncate">
          {[event.category, event.source === "terceiros" ? "Terceiros" : "Comunidade"].filter(Boolean).join(" · ")}
        </p>
        <h3 className={cn("font-black leading-snug group-hover:text-gradient-neon", featured ? "text-2xl md:text-3xl" : "text-lg line-clamp-2")}>{event.name}</h3>
        {summary && <p className={cn("text-sm text-muted-foreground", featured ? "line-clamp-3" : "line-clamp-2")}>{summary}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {event.event_time && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-primary" /> {hhmm(event.event_time)}</span>}
          {mode && <span className="inline-flex items-center gap-1"><mode.icon className="h-3.5 w-3.5 text-primary" /> {mode.label}</span>}
          {place && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate max-w-[14rem]">{place}</span></span>}
        </div>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-primary">
          {event.source === "terceiros" && eventUrl ? <><ExternalLink className="h-4 w-4" /> Detalhes e link oficial</> : onlineUrl ? "Detalhes e transmissão" : "Ver evento"}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
