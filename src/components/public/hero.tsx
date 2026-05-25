import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_CONFIG } from "@/lib/site-config";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-secondary/20 blur-[120px]" />

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
              Comunidade Tech • Networking • Carreira
            </div>

            <h1 className="font-black tracking-tighter text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
              <span className="block text-foreground">GALERA</span>
              <span className="block text-gradient-neon">DO T.I.</span>
            </h1>

            <p className="text-2xl md:text-3xl font-semibold text-foreground/90 max-w-xl">
              {SITE_CONFIG.slogan}
            </p>

            <p className="text-base md:text-lg text-muted-foreground max-w-lg">
              {SITE_CONFIG.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild variant="neon" size="xl">
                <Link to="/cadastro">
                  Entrar na comunidade
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="neon-outline" size="xl">
                <Link to="/canais">Conhecer canais</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              <div className="absolute inset-8 rounded-full border border-secondary/30 grid-bg" />
              <div className="absolute inset-16 rounded-full border border-primary/30" />
              <div className="absolute inset-28 rounded-full bg-gradient-neon opacity-90 blur-2xl animate-pulse-glow" />
              <div className="absolute inset-32 rounded-full bg-gradient-neon flex items-center justify-center">
                <div className="text-6xl font-black text-white drop-shadow-[0_0_20px_rgba(0,240,255,0.8)]">
                  {"</>"}
                </div>
              </div>

              <div className="absolute top-4 right-8 glass px-3 py-1.5 rounded-md text-xs font-semibold text-primary border-primary/40 animate-float">
                DEVELOPMENT
              </div>
              <div className="absolute bottom-12 left-4 glass px-3 py-1.5 rounded-md text-xs font-semibold text-secondary border-secondary/40 animate-float" style={{ animationDelay: "1s" }}>
                GLOBAL TALENT HUB
              </div>
              <div className="absolute top-1/2 -right-2 glass px-3 py-1.5 rounded-md text-xs font-semibold text-[oklch(0.88_0.30_145)] border-[oklch(0.88_0.30_145)]/40 animate-float" style={{ animationDelay: "2s" }}>
                DATA SCIENCE
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}