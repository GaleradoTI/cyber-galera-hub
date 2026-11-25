export type ScheduleItem = { start: string; end?: string; title: string; speaker?: string; room?: string; description?: string };

export type RegistrationStatus = "pending" | "approved" | "rejected" | "waitlist" | "cancelled";

export const REG_STATUS: Record<RegistrationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Aguardando aprovação", variant: "secondary" },
  approved: { label: "Presença aprovada", variant: "default" },
  rejected: { label: "Não aprovada", variant: "destructive" },
  waitlist: { label: "Lista de espera", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

export function parseSchedule(raw: unknown): ScheduleItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as any[])
    .filter((s) => s && typeof s.title === "string" && s.title.trim())
    .map((s) => ({ start: String(s.start ?? ""), end: s.end ? String(s.end) : undefined, title: s.title, speaker: s.speaker || undefined, room: s.room || undefined, description: s.description || undefined }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Colunas legíveis de events. online_link fica de fora: use get_event_online_link(). */
export const EVENT_COLUMNS =
  "id,name,description,category,event_date,event_time,end_time,modality,location_or_link,status,created_by,created_at,updated_at,speakers,theme,address,cover_url,max_attendees,source,approval_status,submitted_by,approval_note,approved_by,approved_at,schedule,requires_approval,source_event_id" as const;

/** Data de hoje (AAAA-MM-DD) em Brasília; toISOString() viraria o dia às 21h. */
export const todayBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

export function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function safeEventUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function eventLinks(event: { location_or_link?: string | null; online_link?: string | null; address?: string | null; source?: string | null }) {
  const legacyUrl = safeEventUrl(event.location_or_link);
  return {
    eventUrl: event.source === "terceiros" ? legacyUrl : null,
    onlineUrl: safeEventUrl(event.online_link) ?? (event.source !== "terceiros" ? legacyUrl : null),
    place: event.address?.trim() || (!legacyUrl ? event.location_or_link?.trim() : null) || null,
  };
}
