import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicPerson = { user_id: string; display_name: string | null; nickname: string | null; avatar_url: string | null };

/** Nome, nick e foto de qualquer membro (a tabela profiles só deixa ler o próprio registro). */
export async function fetchPeople(ids: string[]): Promise<PublicPerson[]> {
  const unique = Array.from(new Set(ids)).sort();
  const out: PublicPerson[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await (supabase as any).rpc("get_public_profiles", { _ids: unique.slice(i, i + 200) });
    if (error) throw error;
    out.push(...((data ?? []) as PublicPerson[]));
  }
  return out;
}

export function usePeople(ids: string[]) {
  const key = Array.from(new Set(ids)).sort().join(",");
  const { data } = useQuery({
    queryKey: ["people", key],
    enabled: key.length > 0,
    staleTime: 60_000,
    // mantém os nomes já carregados enquanto a próxima página do feed chega
    placeholderData: (previous: Map<string, PublicPerson> | undefined) => previous,
    queryFn: async () => new Map((await fetchPeople(key.split(","))).map((p) => [p.user_id, p])),
  });
  return data ?? new Map<string, PublicPerson>();
}

export const handle = (nickname?: string | null) => (nickname ? `@${nickname}` : "");
