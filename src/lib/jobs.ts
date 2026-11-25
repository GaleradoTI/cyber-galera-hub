import { useQuery } from "@tanstack/react-query";
import {
  Archive, Building2, CheckCircle2, CircleDashed, Eye, FileSearch, Globe2, Home, Inbox, Laptop,
  Sprout, Rocket, Star, TrendingUp, GraduationCap, Trophy, XCircle, PauseCircle, type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/resume";

type Meta = { label: string; icon: LucideIcon; className?: string };

export const SENIORITY: Record<string, Meta> = {
  estagio: { label: "Estágio", icon: GraduationCap },
  junior: { label: "Júnior", icon: Sprout },
  pleno: { label: "Pleno", icon: TrendingUp },
  senior: { label: "Sênior", icon: Rocket },
  especialista: { label: "Especialista", icon: Star },
};

export const MODALITY: Record<string, Meta> = {
  remoto: { label: "Remoto", icon: Home },
  hibrido: { label: "Híbrido", icon: Laptop },
  presencial: { label: "Presencial", icon: Building2 },
};

export const JOB_STATUS: Record<string, Meta> = {
  publicado: { label: "Publicada", icon: Eye, className: "bg-primary/15 text-primary border-primary/30" },
  rascunho: { label: "Rascunho", icon: CircleDashed, className: "bg-secondary/15 text-secondary border-secondary/30" },
  pausado: { label: "Pausada", icon: PauseCircle, className: "bg-accent/20 text-foreground border-accent/40" },
  encerrado: { label: "Encerrada", icon: Archive, className: "bg-muted text-muted-foreground border-border" },
};

/** Etapas da candidatura, na ordem do processo. */
export const PIPELINE: (Meta & { key: string })[] = [
  { key: "enviada", label: "Novas", icon: Inbox, className: "text-secondary" },
  { key: "em_analise", label: "Em análise", icon: FileSearch, className: "text-primary" },
  { key: "contratado", label: "Contratados", icon: Trophy, className: "text-accent-foreground" },
  { key: "rejeitada", label: "Não selecionados", icon: XCircle, className: "text-muted-foreground" },
];

export const TYPE_META: Record<string, Meta> = {
  interna: { label: "Candidatura na plataforma", icon: CheckCircle2 },
  externa: { label: "Vaga externa", icon: Globe2 },
};

export type Applicant = {
  application_id: string; job_id: string; job_title: string; company: string; status: string; message: string | null;
  created_at: string; user_id: string; display_name: string; avatar_url: string | null; work_area: string | null;
  tech_tags: string[] | null;
};

/** Candidaturas visíveis a quem está logado (recrutador: das próprias vagas; admin: todas). */
export function useJobApplicants(enabled = true) {
  return useQuery({
    queryKey: ["job-applicants"],
    enabled,
    queryFn: async () => {
      const { data, error } = await db.rpc("get_job_applicants");
      if (error) throw error;
      return (data ?? []) as Applicant[];
    },
  });
}

export function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
