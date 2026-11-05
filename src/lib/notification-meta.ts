import { Bell, Calendar, Briefcase, MessageSquare, UserPlus, FolderKanban, Heart, Info } from "lucide-react";

export const NOTIF_CATEGORIES = [
  { key: "eventos", label: "Eventos", hint: "Inscrições, aprovações, novos eventos e lembretes", icon: Calendar, tone: "text-secondary bg-secondary/15" },
  { key: "vagas", label: "Vagas", hint: "Novas vagas e candidaturas", icon: Briefcase, tone: "text-accent bg-accent/15" },
  { key: "mensagens", label: "Mensagens", hint: "Mensagens diretas recebidas", icon: MessageSquare, tone: "text-primary bg-primary/15" },
  { key: "interacoes", label: "Curtidas e comentários", hint: "Reações e respostas nos seus posts", icon: Heart, tone: "text-destructive bg-destructive/15" },
  { key: "seguidores", label: "Seguidores", hint: "Quando alguém começa a te seguir", icon: UserPlus, tone: "text-primary bg-primary/15" },
  { key: "projetos", label: "Projetos e squads", hint: "Pedidos, entregas e posts dos projetos", icon: FolderKanban, tone: "text-secondary bg-secondary/15" },
] as const;

const SYSTEM = { key: "sistema", label: "Sistema", hint: "", icon: Info, tone: "text-muted-foreground bg-muted" };

/** Espelha public.notification_category no banco. */
export function notificationCategory(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("message") || t.startsWith("dm")) return "mensagens";
  if (t.includes("event") || t.includes("registration") || t.includes("checkin")) return "eventos";
  if (t.includes("job") || t.includes("application") || t.includes("vaga")) return "vagas";
  if (t.includes("follow")) return "seguidores";
  if (t.includes("project") || t.includes("squad") || t.includes("task") || t.includes("join")) return "projetos";
  if (t.includes("comment") || t.includes("reaction") || t.includes("feed") || t.includes("post")) return "interacoes";
  return "sistema";
}

export function categoryMeta(type: string) {
  const k = notificationCategory(type);
  return NOTIF_CATEGORIES.find((c) => c.key === k) ?? SYSTEM;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export { Bell };
