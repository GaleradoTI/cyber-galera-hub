import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Calendar, Heart, ShieldCheck, LogOut, Crown, Sparkles, Users, FileText, MessageCircle, HelpCircle, Settings } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/hooks/use-auth";

const ROLE_META: Record<string, { label: string; icon: any; className: string; description: string }> = {
  SUPER_ADMIN: { label: "SUPER ADMIN", icon: Crown, className: "border-secondary text-secondary shadow-[0_0_20px_hsl(var(--secondary)/0.4)]", description: "Acesso total à plataforma, incluindo gestão de papéis." },
  ADMIN: { label: "ADMIN", icon: ShieldCheck, className: "border-primary text-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]", description: "Gestão de conteúdo, vagas, eventos, FAQ e usuários." },
  MODERADOR: { label: "MODERADOR", icon: Sparkles, className: "border-accent text-accent", description: "Curadoria de conteúdo e moderação da comunidade." },
  MEMBRO: { label: "MEMBRO", icon: Users, className: "border-muted text-muted-foreground", description: "Acesso à comunidade, vagas e eventos." },
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GALERA DO T.I." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role);
    },
  });

  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const primaryRole = roles.includes("SUPER_ADMIN") ? "SUPER_ADMIN" : roles.includes("ADMIN") ? "ADMIN" : roles.includes("MODERADOR") ? "MODERADOR" : "MEMBRO";
  const roleMeta = ROLE_META[primaryRole] ?? ROLE_META.MEMBRO;
  const RoleIcon = roleMeta.icon;

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

  if (loading || !isAuthenticated) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Carregando...</div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.3em] text-secondary mb-2">ÁREA DO MEMBRO</div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Olá, <span className="text-gradient-neon">{profile?.display_name ?? user?.email}</span>
            </h1>
            <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full border bg-background/40 backdrop-blur ${roleMeta.className}`}>
              <RoleIcon className="h-4 w-4" />
              <span className="text-xs font-bold tracking-[0.2em]">{roleMeta.label}</span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">{roleMeta.description}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          <StatCard icon={Heart} label="Vagas salvas" value={savedJobs} />
          <StatCard icon={Calendar} label="Eventos com interesse" value={interests} />
          <StatCard icon={Briefcase} label="Seu papel" value={roles[0] ?? "MEMBRO"} />
          <StatCard icon={ShieldCheck} label="Status" value={profile?.is_blocked ? "Bloqueado" : "Ativo"} />
        </div>

        <div className="grid md:grid-cols-2 gap-5 mt-10">
          <Link to="/vagas" className="glass rounded-xl p-6 hover-glow-magenta">
            <Briefcase className="h-6 w-6 text-secondary" />
            <h3 className="font-bold mt-3">Explorar vagas</h3>
            <p className="text-sm text-muted-foreground mt-1">Veja todas as oportunidades publicadas.</p>
          </Link>
          <Link to="/eventos" className="glass rounded-xl p-6 hover-glow-cyan">
            <Calendar className="h-6 w-6 text-primary" />
            <h3 className="font-bold mt-3">Próximos eventos</h3>
            <p className="text-sm text-muted-foreground mt-1">Participe dos encontros da comunidade.</p>
          </Link>
        </div>

        {isAdmin && (
          <div className="mt-10">
            <div className="flex items-center gap-2 text-secondary mb-4">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-bold tracking-[0.3em]">PAINEL ADMINISTRATIVO</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AdminCard icon={Briefcase} title="Gerenciar Vagas" desc="Criar, editar e publicar oportunidades." />
              <AdminCard icon={Calendar} title="Gerenciar Eventos" desc="Agenda, lives, meetups e workshops." />
              <AdminCard icon={MessageCircle} title="Canais Oficiais" desc="WhatsApp, Discord, Telegram e redes." />
              <AdminCard icon={HelpCircle} title="FAQ" desc="Perguntas frequentes da comunidade." />
              <AdminCard icon={FileText} title="Logs de Auditoria" desc="Histórico de ações administrativas." />
              {isSuperAdmin && <AdminCard icon={Crown} title="Usuários & Papéis" desc="Promover ADMIN/MODERADOR (somente SUPER ADMIN)." superAdmin />}
              {isSuperAdmin && <AdminCard icon={Settings} title="Editor do Site" desc="Hero, contatos, números e redes sociais." superAdmin />}
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl p-5">
      <Icon className="h-5 w-5 text-primary" />
      <div className="text-2xl font-black mt-3 text-gradient-neon">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function AdminCard({ icon: Icon, title, desc, superAdmin = false }: { icon: any; title: string; desc: string; superAdmin?: boolean }) {
  return (
    <div className={`glass rounded-xl p-5 border ${superAdmin ? "border-secondary/40 hover-glow-magenta" : "border-primary/30 hover-glow-cyan"} cursor-pointer transition`}>
      <Icon className={`h-5 w-5 ${superAdmin ? "text-secondary" : "text-primary"}`} />
      <h4 className="font-bold mt-3 text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      <div className="text-[10px] font-bold tracking-[0.2em] mt-3 text-muted-foreground">EM BREVE</div>
    </div>
  );
}