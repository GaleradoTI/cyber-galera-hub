import { motion } from "framer-motion";
import { Users, Building2, Briefcase, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type HomeStats = { members?: number; recruiters?: number; jobs?: number; events?: number };

const formatCount = (value: number | undefined) =>
  typeof value === "number" ? new Intl.NumberFormat("pt-BR").format(value) : "—";

export function StatsSection() {
  const { data } = useQuery({
    queryKey: ["public-home-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_home_stats");
      if (error) throw error;
      return (data ?? {}) as HomeStats;
    },
  });

  const stats = [
    { icon: Users, value: formatCount(data?.members), label: "Membros Ativos", color: "text-primary" },
    { icon: Building2, value: formatCount(data?.recruiters), label: "Recrutadores Conectados", color: "text-secondary" },
    { icon: Briefcase, value: formatCount(data?.jobs), label: "Vagas Publicadas", color: "text-[oklch(0.88_0.30_145)]" },
    { icon: Calendar, value: formatCount(data?.events), label: "Eventos Publicados", color: "text-[oklch(0.78_0.18_65)]" },
  ];

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="glass rounded-2xl p-8 md:p-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4"
              >
                <div className={`h-12 w-12 rounded-xl glass flex items-center justify-center ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {stat.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}