import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star, MessageSquareQuote, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Testimonial = {
  id: string;
  rating: number;
  content: string;
  role_title: string | null;
  company: string | null;
  created_at: string;
  author_name: string | null;
  author_avatar_url: string | null;
  author_work_area: string | null;
};

export function TestimonialsSection() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select(
          "id,rating,content,role_title,company,created_at,author_name,author_avatar_url,author_work_area",
        )
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(9);
      if (error) return [];
      return (data ?? []) as Testimonial[];
    },
  });

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2 flex items-center gap-2">
            <MessageSquareQuote className="h-3 w-3" /> COMUNIDADE
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">O que dizem por aí</h2>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Depoimentos enviados por membros e recrutadores da Galera do T.I.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-10">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-5 border border-primary/20 animate-pulse space-y-3">
              <div className="h-4 w-24 bg-muted/40 rounded" />
              <div className="h-3 w-full bg-muted/30 rounded" />
              <div className="h-3 w-4/5 bg-muted/30 rounded" />
              <div className="flex items-center gap-3 pt-4">
                <div className="w-11 h-11 rounded-full bg-muted/40" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-28 bg-muted/40 rounded" />
                  <div className="h-2 w-20 bg-muted/30 rounded" />
                </div>
              </div>
            </div>
          ))}

        {items.map((t, i) => {
          const name = t.author_name?.trim() || "Membro da galera";
          const avatar = t.author_avatar_url?.trim() || null;
          const role = t.role_title?.trim() || t.author_work_area?.trim() || null;
          const company = t.company?.trim() || null;
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
                {avatar ? (
                  <img
                    src={avatar}
                    alt={`Foto de ${name}`}
                    loading="lazy"
                    className="w-11 h-11 rounded-full object-cover border border-primary/30 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-xs font-black">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{name}</div>
                  {role && <div className="text-[11px] text-primary/90 truncate">{role}</div>}
                  {company && (
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {company}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
