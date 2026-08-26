import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star, MessageSquareQuote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Testimonial = {
  id: string;
  user_id: string;
  rating: number;
  content: string;
  role_title: string | null;
  created_at: string;
};
type Profile = { user_id: string; display_name: string; avatar_url: string | null; work_area: string | null };

export function TestimonialsSection() {
  const { data: items = [] } = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("id,user_id,rating,content,role_title,created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(9);
      if (error) return [];
      return (data ?? []) as Testimonial[];
    },
  });

  const userIds = Array.from(new Set(items.map((t) => t.user_id)));
  const { data: profiles = [] } = useQuery({
    queryKey: ["public-testimonials-authors", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_profiles")
        .select("user_id,display_name,avatar_url")
        .in("user_id", userIds);
      if (error) return [];
      return (data ?? []) as Profile[];
    },
  });
  const profById = new Map(profiles.map((p) => [p.user_id, p]));

  if (items.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2 flex items-center gap-2">
            <MessageSquareQuote className="h-3 w-3" /> COMUNIDADE
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">O que dizem por aí</h2>
          <p className="text-muted-foreground mt-2 max-w-xl">Depoimentos enviados por membros e recrutadores da Galera do T.I.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-10">
        {items.map((t, i) => {
          const p = profById.get(t.user_id);
          return (
            <motion.article
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-5 border border-primary/20 flex flex-col"
            >
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn("h-4 w-4", n <= t.rating ? "fill-secondary text-secondary" : "text-muted-foreground/30")}
                  />
                ))}
              </div>
              <p className="text-sm leading-relaxed flex-1 whitespace-pre-wrap">"{t.content}"</p>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/40">
                {p?.avatar_url ? (
                  <img src={p.avatar_url} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-xs font-black">
                    {(p?.display_name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{p?.display_name ?? "Membro da galera"}</div>
                  {t.role_title && <div className="text-[11px] text-muted-foreground truncate">{t.role_title}</div>}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}