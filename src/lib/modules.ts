import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteModules = { raffles?: boolean };

/** Reads the optional-modules toggle stored in public_site_settings. */
export function useSiteModules() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-modules"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("public_site_settings")
        .select("setting_value")
        .eq("setting_key", "modules")
        .maybeSingle();
      return (data?.setting_value ?? {}) as SiteModules;
    },
  });
  return { modules: data ?? {}, rafflesEnabled: !!data?.raffles, loading: isLoading };
}
