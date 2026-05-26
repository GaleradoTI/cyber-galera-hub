import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Calendar, Heart, ShieldCheck, Users, MessageCircle, HelpCircle, Settings, FileText, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";

export const Route = createFileRoute("/dashboard/")({ component: DashboardIndex });

function DashboardIndex() {
  const { user, isAdmin, isSuperAdmin, primary, profile } = useDashboardRoles();

  const { data: savedJobs = 0 } = useQuery({
    queryKey: ["saved-jobs-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase.from("saved_jobs").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  const { data: interests = 0 } = useQuery({
    queryKey: ["interests-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase.from("user_event_interests").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  return (
    <DashboardShell title={`Olá, ${profile?.display_name ?? user?.email ?? ""}`} description="Sua área pessoal na GALERA DO T.I.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Heart} label="Vagas salvas" value={savedJobs} />
        <Stat icon={Calendar} label="Eventos com interesse" value={interests} />
        <Stat icon={Briefcase} label="Seu papel" value={primary} />
        <Stat icon={ShieldCheck} label="Status" value={profile?.is_blocked ? "Bloqueado" : "Ativo"} />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-8">
        <Link to="/dashboard/vagas" className="glass rounded-xl p-6 hover-glow-magenta">
          <Briefcase className="h-6 w-6 text-secondary" />
          <h3 className="font-bold mt-3">Explorar vagas</h3>
          <p className="text-sm text-muted-foreground mt-1">Gerencie e veja todas as vagas no dashboard.</p>
        </Link>
        <Link to="/dashboard/eventos" className="glass rounded-xl p-6 hover-glow-cyan">
          <Calendar className="h-6 w-6 text-primary" />
          <h3 className="font-bold mt-3">Próximos eventos</h3>
          <p className="text-sm text-muted-foreground mt-1">Gerencie e veja todos os eventos no dashboard.</p>
        </Link>
      </div>

      {isAdmin && (
        <div className="mt-10">
          <div className="flex items-center gap-2 text-secondary mb-4">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-bold tracking-[0.3em]">PAINEL ADMINISTRATIVO</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AdminLink to="/dashboard/usuarios" icon={Users} title="Usuários" desc={isSuperAdmin ? "Gerencie ADMIN e MEMBRO." : "Gerencie membros (ativar/bloquear)."} accent={isSuperAdmin} />
            <AdminLink to="/dashboard/vagas" icon={Briefcase} title="Vagas" desc="Criar, editar e publicar vagas." />
            <AdminLink to="/dashboard/eventos" icon={Calendar} title="Eventos" desc="Agenda, lives e workshops." />
            <AdminLink to="/dashboard/configuracoes" icon={Settings} title="Configurações do Site" desc="Hero, contatos, redes e textos públicos." accent />
            <AdminLink to="/dashboard/logs" icon={FileText} title="Logs de Auditoria" desc="Histórico de ações administrativas." />
            {isSuperAdmin && (
              <div className="glass rounded-xl p-5 border border-secondary/40">
                <Crown className="h-5 w-5 text-secondary" />
                <h4 className="font-bold mt-3 text-sm">Papéis avançados</h4>
                <p className="text-xs text-muted-foreground mt-1">Promoção de SUPER ADMIN via SQL editor por segurança.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl p-5">
      <Icon className="h-5 w-5 text-primary" />
      <div className="text-2xl font-black mt-3 text-gradient-neon">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function AdminLink({ to, icon: Icon, title, desc, accent }: { to: string; icon: any; title: string; desc: string; accent?: boolean }) {
  return (
    <Link to={to} className={`glass rounded-xl p-5 border ${accent ? "border-secondary/40 hover-glow-magenta" : "border-primary/30 hover-glow-cyan"} transition`}>
      <Icon className={`h-5 w-5 ${accent ? "text-secondary" : "text-primary"}`} />
      <h4 className="font-bold mt-3 text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </Link>
  );
}
