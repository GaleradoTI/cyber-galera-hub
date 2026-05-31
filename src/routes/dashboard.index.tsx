import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Briefcase, Calendar, FolderKanban, Heart, ShieldCheck, Users, Sparkles, ClipboardList, Inbox, CheckCheck, X, UserPlus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { calcMatchPercent, matchClass } from "@/lib/match";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/")({ component: DashboardIndex });

function DashboardIndex() {
  const { user, isAdmin, isSuperAdmin, isRecruiter, primary, profile } = useDashboardRoles();

  return (
    <DashboardShell
      title={`Olá, ${profile?.display_name ?? user?.email ?? ""}`}
      description={
        isAdmin ? "Painel administrativo da comunidade."
        : isRecruiter ? "Sua central de recrutamento."
        : "Sua área pessoal na GALERA DO T.I."
      }
    >
      {isAdmin ? (
        <AdminHome isSuperAdmin={isSuperAdmin} />
      ) : isRecruiter ? (
        <RecruiterHome userId={user!.id} />
      ) : (
        <MemberHome userId={user!.id} techTags={profile?.tech_tags ?? []} role={primary} />
      )}
    </DashboardShell>
  );
}

/* ===================== MEMBER ===================== */

function MemberHome({ userId, techTags, role }: { userId: string; techTags: string[]; role: string }) {
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ["dash-jobs-match"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id,title,company,technologies,modality").eq("status", "publicado").limit(50);
      return data ?? [];
    },
  });

  const matched = useMemo(() => {
    return jobs
      .map((j: any) => ({ ...j, pct: calcMatchPercent(techTags, j.technologies) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [jobs, techTags]);

  const { data: apps = [], isLoading: loadingApps } = useQuery({
    queryKey: ["dash-apps", userId],
    queryFn: async () => {
      const { data } = await supabase.from("job_applications").select("id,status,job_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["dash-upcoming-events"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("events").select("id,name,event_date").eq("status", "publicado").gte("event_date", today).order("event_date").limit(5);
      return data ?? [];
    },
  });

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={Sparkles} label="Match (média top 6)" value={matched.length ? `${Math.round(matched.reduce((s, j) => s + j.pct, 0) / matched.length)}%` : "—"} />
        <Stat icon={ClipboardList} label="Candidaturas ativas" value={apps.filter((a: any) => a.status !== "rejeitada").length} />
        <Stat icon={Calendar} label="Eventos próximos" value={events.length} />
      </div>

      <Section title="Vagas casadas com seu perfil" hint={techTags.length === 0 ? "Adicione tech tags no seu perfil pra melhorar o match." : undefined} action={<Link to="/vagas" className="text-xs text-primary hover:underline">Ver todas →</Link>}>
        {loadingJobs ? <SkeletonGrid /> : matched.length === 0 ? <Empty msg="Nenhuma vaga publicada no momento." /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {matched.map((j) => (
              <Link key={j.id} to="/vagas" className="glass rounded-xl p-4 border border-primary/20 hover:border-primary/50 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{j.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{j.company} • {j.modality}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${matchClass(j.pct)}`}>{j.pct}% match</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <Section title="Minhas candidaturas" action={<Link to="/dashboard/candidaturas" className="text-xs text-primary hover:underline">Ver todas →</Link>}>
          {loadingApps ? <Skeleton className="h-24 rounded-xl" /> : apps.length === 0 ? <Empty msg="Você ainda não se candidatou a nada." /> : (
            <ul className="space-y-2 text-sm">
              {apps.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between glass rounded-lg p-3 border border-primary/10">
                  <span className="text-muted-foreground">Vaga {a.job_id.slice(0, 8)}</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Próximos eventos" action={<Link to="/eventos" className="text-xs text-primary hover:underline">Ver agenda →</Link>}>
          {loadingEvents ? <Skeleton className="h-24 rounded-xl" /> : events.length === 0 ? <Empty msg="Nada agendado por enquanto." /> : (
            <ul className="space-y-2 text-sm">
              {events.map((e: any) => (
                <li key={e.id} className="flex items-center justify-between glass rounded-lg p-3 border border-primary/10">
                  <span className="truncate">{e.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

/* ===================== RECRUITER ===================== */

function RecruiterHome({ userId }: { userId: string }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ["rec-jobs", userId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id,title,status").eq("created_by", userId);
      return data ?? [];
    },
  });
  const jobIds = jobs.map((j: any) => j.id);

  const { data: apps = [] } = useQuery({
    queryKey: ["rec-apps", jobIds.join(",")],
    enabled: jobIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("job_applications").select("id,status,job_id,created_at").in("job_id", jobIds);
      return data ?? [];
    },
  });

  const funnel = useMemo(() => {
    const buckets = { enviada: 0, em_analise: 0, contratado: 0, rejeitada: 0 } as Record<string, number>;
    apps.forEach((a: any) => { buckets[a.status] = (buckets[a.status] ?? 0) + 1; });
    return buckets;
  }, [apps]);

  const oneWeekAgo = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const newThisWeek = apps.filter((a: any) => new Date(a.created_at).getTime() > oneWeekAgo).length;

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Inbox} label="Enviadas" value={funnel.enviada ?? 0} />
        <Stat icon={ClipboardList} label="Em análise" value={funnel.em_analise ?? 0} />
        <Stat icon={CheckCheck} label="Contratado" value={funnel.contratado ?? 0} />
        <Stat icon={X} label="Rejeitada" value={funnel.rejeitada ?? 0} />
      </div>

      <Section title="Resumo da semana">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="glass rounded-xl p-5 border border-primary/20">
            <UserPlus className="h-5 w-5 text-primary" />
            <div className="text-2xl font-black text-gradient-neon mt-2">{newThisWeek}</div>
            <div className="text-xs text-muted-foreground">Candidaturas novas nos últimos 7 dias</div>
          </div>
          <div className="glass rounded-xl p-5 border border-secondary/20">
            <Briefcase className="h-5 w-5 text-secondary" />
            <div className="text-2xl font-black text-gradient-neon mt-2">{jobs.filter((j: any) => j.status === "publicado").length}</div>
            <div className="text-xs text-muted-foreground">Suas vagas publicadas (de {jobs.length})</div>
          </div>
        </div>
      </Section>

      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        <QuickAction to="/dashboard/vagas" icon={Plus} title="Nova vaga" desc="Publique uma oportunidade." />
        <QuickAction to="/dashboard/candidatos" icon={Users} title="Candidatos" desc="Veja quem está em busca." />
        <QuickAction to="/dashboard/mensagens" icon={Inbox} title="Mensagens" desc="Fale direto com talentos." />
      </div>
    </>
  );
}

/* ===================== ADMIN ===================== */

function AdminHome({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { data: stats } = useQuery({
    queryKey: ["admin-kpis"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [users, jobs, events, projects] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("is_blocked", false),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "publicado"),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "publicado").gte("event_date", today),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "ativo"),
      ]);
      return {
        users: users.count ?? 0,
        jobs: jobs.count ?? 0,
        events: events.count ?? 0,
        projects: projects.count ?? 0,
      };
    },
  });

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Usuários ativos" value={stats?.users ?? "…"} />
        <Stat icon={Briefcase} label="Vagas publicadas" value={stats?.jobs ?? "…"} />
        <Stat icon={Calendar} label="Eventos próximos" value={stats?.events ?? "…"} />
        <Stat icon={FolderKanban} label="Projetos ativos" value={stats?.projects ?? "…"} />
      </div>

      <Section title="Painel administrativo">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction to="/dashboard/usuarios" icon={Users} title="Usuários" desc="Gerenciar membros e papéis." accent={isSuperAdmin} />
          <QuickAction to="/dashboard/vagas" icon={Briefcase} title="Vagas" desc="Criar, editar e publicar." />
          <QuickAction to="/dashboard/eventos" icon={Calendar} title="Eventos" desc="Agenda da comunidade." />
          <QuickAction to="/dashboard/projetos" icon={FolderKanban} title="Projetos / Squads" desc="Vitrine e equipes." />
          <QuickAction to="/dashboard/configuracoes" icon={ShieldCheck} title="Site" desc="Conteúdo público." accent />
          {isSuperAdmin && <QuickAction to="/dashboard/cargos" icon={Heart} title="Cargos / Badges" desc="Distinções de membros." />}
        </div>
      </Section>
    </>
  );
}

/* ===================== UI bits ===================== */

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl p-5 animate-in fade-in">
      <Icon className="h-5 w-5 text-primary" />
      <div className="text-2xl font-black mt-3 text-gradient-neon">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <div className="flex items-end justify-between mb-3 gap-2">
        <div>
          <h2 className="text-sm font-bold tracking-[0.25em] text-muted-foreground/80">{title.toUpperCase()}</h2>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, desc, accent }: { to: string; icon: any; title: string; desc: string; accent?: boolean }) {
  return (
    <Link to={to} className={`glass rounded-xl p-5 border ${accent ? "border-secondary/40 hover-glow-magenta" : "border-primary/30 hover-glow-cyan"} transition`}>
      <Icon className={`h-5 w-5 ${accent ? "text-secondary" : "text-primary"}`} />
      <h4 className="font-bold mt-3 text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground glass rounded-xl p-6 text-center border border-border/40">{msg}</p>;
}
