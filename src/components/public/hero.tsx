import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_CONFIG } from "@/lib/site-config";
import { supabase } from "@/integrations/supabase/client";
import mascotFallback from "@/assets/mascot-axolotl.png";

type HeroSettings = {
  title?: string;
  subtitle?: string;
  slogan?: string;
  description?: string;
  cta_primary?: string;
  cta_secondary?: string;
};

type MascotSettings = {
  items?: { name?: string; image_url?: string; placement?: string; caption?: string }[];
};

export function Hero() {
  const [mascotFailed, setMascotFailed] = useState(false);
  const { data } = useQuery({
    queryKey: ["public-hero-settings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("public_site_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["hero", "mascots"]);
      return Object.fromEntries((data ?? []).map((s: any) => [s.setting_key, s.setting_value])) as {
        hero?: HeroSettings;
        mascots?: MascotSettings;
      };
    },
  });
  const hero = data?.hero ?? {};
  const mascot = data?.mascots?.items?.find((m) => (m.placement ?? "home_hero") === "home_hero") ?? data?.mascots?.items?.[0];
  const mascotUrl = mascotFailed ? mascotFallback : mascot?.image_url || mascotFallback;

  return (
    <section className="relative overflow-hidden bg-hero">
      <div className="absolute inset-0 grid-bg opacity-40" />

      <div className="container relative mx-auto px-4 py-24 md:py-32 lg:py-40">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-medium text-secondary border-secondary/30">
              <Sparkles className="h-3.5 w-3.5" />
              {hero.subtitle ?? "Comunidade Tech • Networking • Carreira"}
            </div>

            <h1 className="font-black tracking-tighter text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
              {(hero.title ?? "GALERA DO T.I.").split(" ").slice(0, -2).join(" ") ? (
                <span className="block text-foreground">{(hero.title ?? "GALERA DO T.I.").split(" ").slice(0, -2).join(" ")}</span>
              ) : null}
              <span className="block text-gradient-neon">{(hero.title ?? "GALERA DO T.I.").split(" ").slice(-2).join(" ")}</span>
            </h1>

            <p className="text-2xl md:text-3xl font-semibold text-foreground/90 max-w-xl">
              {hero.slogan ?? SITE_CONFIG.slogan}
            </p>

            <p className="text-base md:text-lg text-muted-foreground max-w-lg">
              {hero.description ?? SITE_CONFIG.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild variant="neon" size="xl">
                <Link to="/cadastro">
                  {hero.cta_primary ?? "Entrar na comunidade"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="neon-outline" size="xl">
                <Link to="/canais">{hero.cta_secondary ?? "Conhecer canais"}</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative aspect-square max-w-lg mx-auto">
              <div className="absolute inset-x-6 bottom-8 h-24 rounded-full bg-primary/25 blur-3xl" />
              <img src={mascotUrl} alt={mascot?.name ?? "Mascote da GALERA DO T.I."} width={1024} height={1024} className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_42px_oklch(0.65_0.30_0/0.45)]" onError={() => setMascotFailed(true)} />
              {mascot?.caption && (
                <div className="absolute bottom-8 left-8 right-8 z-20 glass rounded-lg px-4 py-2 text-xs font-semibold text-secondary border-secondary/30">
                  {mascot.caption}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}