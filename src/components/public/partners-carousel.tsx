import { useQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Handshake } from "lucide-react";

export function PartnersCarousel() {
  const { data: partners = [] } = useQuery({
    queryKey: ["public-partners"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("partners")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  if (partners.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">QUEM CAMINHA COM A GENTE</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
            <Handshake className="h-7 w-7 text-primary" /> Parceiros
          </h2>
        </div>
      </div>
      <Carousel
        opts={{ align: "start", loop: partners.length > 4 }}
        plugins={partners.length > 4 ? [Autoplay({ delay: 3500, stopOnInteraction: true })] : []}
        className="px-10"
      >
        <CarouselContent>
          {partners.map((p: any) => {
            const inner = (
              <div className="glass rounded-xl p-5 h-full flex flex-col items-center text-center hover-glow-cyan transition border border-border/40">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} loading="lazy" className="h-16 w-auto object-contain mb-3" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-gradient-neon mb-3 flex items-center justify-center font-black text-background text-xl">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="font-bold text-sm">{p.name}</div>
                {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                {p.website_url && (
                  <span className="mt-2 text-[10px] text-primary inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Visitar
                  </span>
                )}
              </div>
            );
            return (
              <CarouselItem key={p.id} className="basis-1/2 md:basis-1/3 lg:basis-1/4">
                {p.website_url ? (
                  <a href={p.website_url} target="_blank" rel="noopener noreferrer">{inner}</a>
                ) : (
                  inner
                )}
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>
  );
}