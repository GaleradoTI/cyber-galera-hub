import { useQuery } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ChannelGrid() {
  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {channels.map((c: any) => {
        const Icon =
          (c.icon_name && (Icons as any)[c.icon_name]) || Icons.Globe;
        return (
          <a
            key={c.id}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-xl p-5 hover-glow-magenta group flex flex-col items-center text-center gap-2"
          >
            <Icon className="h-7 w-7 text-secondary group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-sm group-hover:text-gradient-neon transition">
              {c.name}
            </h3>
            {c.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                {c.description}
              </p>
            )}
          </a>
        );
      })}
    </div>
  );
}