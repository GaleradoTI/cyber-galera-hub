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

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

export function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
