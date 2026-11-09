import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const AMBASSADOR_AREAS = [
  { key: "eventos", label: "Eventos", hint: "Criar, editar e aprovar eventos, inscrições e check-in", route: "/dashboard/eventos" },
  { key: "vagas", label: "Vagas", hint: "Publicar e editar vagas", route: "/dashboard/vagas" },
  { key: "parceiros", label: "Parceiros", hint: "Gerenciar empresas parceiras", route: "/dashboard/parceiros" },
  { key: "candidatos", label: "Candidatos", hint: "Ver membros buscando emprego", route: "/dashboard/candidatos" },
  { key: "depoimentos", label: "Depoimentos", hint: "Aprovar ou recusar depoimentos", route: "/dashboard/depoimentos" },
  { key: "denuncias", label: "Denúncias", hint: "Analisar e resolver denúncias", route: "/dashboard/denuncias" },
  { key: "noticias", label: "Notícias", hint: "Publicar notícias oficiais", route: "/dashboard/noticias" },
  { key: "feed", label: "Moderar feed", hint: "Ocultar posts que quebram as regras", route: null },
  { key: "faqs", label: "Perguntas frequentes", hint: "Editar o FAQ do site", route: null },
] as const;

export type AmbassadorArea = (typeof AMBASSADOR_AREAS)[number]["key"];

export const AREA_ACTIONS: Record<AmbassadorArea, readonly string[]> = {
  eventos: ["criar", "editar", "publicar", "aprovar", "remover", "inscricoes", "checkin"],
  vagas: ["criar", "editar", "publicar", "remover"],
  noticias: ["criar", "editar", "publicar", "remover"],
  parceiros: ["criar", "editar", "remover"],
  candidatos: [], depoimentos: ["aprovar"], denuncias: ["aprovar"],
  feed: ["aprovar"], faqs: ["criar", "editar", "remover"],
};
export const ACTION_LABELS: Record<string, string> = { criar: "Criar", editar: "Editar", publicar: "Publicar / despublicar", aprovar: "Aprovar / recusar", remover: "Remover", inscricoes: "Aprovar inscrições e emitir crachás", checkin: "Ler QR Code e confirmar presença" };
export function hasAreaAccess(areas: readonly string[], area: string) {
  return areas.includes(area) || areas.some((key) => key.startsWith(`${area}:`));
}
export function hasActionAccess(areas: readonly string[], area: string, action: string) {
  return areas.includes(`${area}:${action}`);
}

export function useAmbassadorAreas(userId: string | undefined, enabled: boolean) {
  const { data = [], isFetched } = useQuery({
    queryKey: ["ambassador-areas", userId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("ambassador_permissions").select("areas").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return (data?.areas ?? []) as string[];
    },
  });
  return { areas: data, ready: !enabled || isFetched };
}
