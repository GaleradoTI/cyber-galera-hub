import { motion } from "framer-motion";
import { Users, Building2, Briefcase, Calendar } from "lucide-react";

const STATS = [
  { icon: Users, value: "500+", label: "Membros Ativos", color: "text-primary" },
  { icon: Building2, value: "80+", label: "Recrutadores Conectados", color: "text-secondary" },
  { icon: Briefcase, value: "120+", label: "Vagas Publicadas", color: "text-[oklch(0.88_0.30_145)]" },
  { icon: Calendar, value: "30+", label: "Eventos Realizados", color: "text-[oklch(0.78_0.18_65)]" },
];

export function StatsSection() {
  return (
    <section className="container mx-auto px-4 py-16">
      <div className="glass rounded-2xl p-8 md:p-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, i) => {
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