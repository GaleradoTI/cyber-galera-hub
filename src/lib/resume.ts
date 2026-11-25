import { supabase } from "@/integrations/supabase/client";

export type Education = { course: string; institution: string; level: string; period: string };
export type Course = { name: string; provider: string; year: string; url: string };
export type Experience = { role: string; company: string; period: string; description: string };
export type Language = { name: string; level: string };

export type CandidateDetails = {
  user_id: string; display_name: string; avatar_url: string | null; bio: string | null;
  work_area: string | null; tech_tags: string[] | null; social_links: Record<string, string> | null;
  city: string | null; state: string | null; looking_for_job: boolean; contact_visible: boolean;
  email: string | null; phone: string | null; resume_path: string | null; resume_name: string | null;
  salary_expectation: string | null; headline: string | null; availability: string | null;
  preferred_modality: string | null;
  education: Education[]; courses: Course[]; experiences: Experience[]; languages: Language[];
};

export const APPLICATION_STATUS: Record<string, string> = {
  enviada: "Enviada",
  em_analise: "Em análise",
  contratado: "Contratado",
  rejeitada: "Não selecionada",
};

export const MISSING_FIELD_LABEL: Record<string, string> = {
  nome: "Nome",
  telefone: "Telefone / WhatsApp",
  area: "Área de atuação",
  cidade: "Cidade e estado",
  formacao: "Pelo menos uma formação (ou anexe um currículo)",
  conhecimentos: "Pelo menos um conhecimento (ou anexe um currículo)",
};

/** Tabelas e funções novas ainda não estão nos tipos gerados do Supabase. */
export const db = supabase as any;

export async function openResume(path: string) {
  // Abre a aba antes do await para o navegador não bloquear como pop-up.
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 120);
  if (error || !data?.signedUrl) {
    tab?.close();
    throw new Error(error?.message ?? "Não foi possível abrir o currículo.");
  }
  if (tab) { tab.opener = null; tab.location.href = data.signedUrl; }
  else window.location.href = data.signedUrl;
}

/** Só links http(s)/mailto viram clicáveis (os dados são digitados pelo usuário). */
export function safeLink(value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v) ? `https://${v}` : null;
}
