import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import mascotFallback from "@/assets/mascot-axolotl.png";

type MascotItem = {
  name?: string;
  image_url?: string;
  placement?: string;
  caption?: string;
};

type Props = {
  placement: string;
  className?: string;
  compact?: boolean;
};

export function PublicMascotSpot({ placement, className = "", compact = false }: Props) {
  const [failed, setFailed] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ["public-mascots"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("public_site_settings")
        .select("setting_value")
        .eq("setting_key", "mascots")
        .maybeSingle();
      const raw = (data?.setting_value as { items?: MascotItem[] } | null)?.items;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const mascot = items.find((item) => item.placement === placement);
  if (!mascot) return null;
  const imageSrc = failed ? mascotFallback : mascot.image_url || mascotFallback;

  return (
    <figure className={`relative flex ${compact ? "items-center gap-3" : "flex-col items-center text-center"} ${className}`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={mascot.name || "Mascote da GALERA DO T.I."}
          className={compact ? "h-20 w-20 object-contain drop-shadow-[0_0_24px_oklch(0.65_0.30_0/0.32)]" : "h-40 w-40 md:h-56 md:w-56 object-contain drop-shadow-[0_0_36px_oklch(0.65_0.30_0/0.38)]"}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={compact ? "h-20 w-20 rounded-lg border border-border/40 bg-muted/20 flex items-center justify-center" : "h-40 w-40 md:h-56 md:w-56 rounded-lg border border-border/40 bg-muted/20 flex items-center justify-center"}>
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      {mascot.caption && (
        <figcaption className={compact ? "text-xs text-muted-foreground max-w-44" : "mt-3 text-sm font-semibold text-secondary max-w-xs"}>
          {mascot.caption}
        </figcaption>
      )}
    </figure>
  );
}