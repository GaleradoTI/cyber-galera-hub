import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Briefcase, Calendar, FolderKanban, Heart, ShieldCheck, Users, Sparkles, ClipboardList, Inbox, CheckCheck, X, UserPlus, Plus, MapPin, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { calcMatchPercent, matchClass } from "@/lib/match";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateOnly } from "@/lib/utils";
import { countBy, getAgeRange, getGenderLabel } from "@/lib/profile-demographics";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/")({ component: DashboardIndex });

function DashboardIndex() {
  const { user, isAdmin, isSuperAdmin, isRecruiter, primary, profile, rolesLoading, rolesReady } = useDashboardRoles();

  if (!user || rolesLoading || !rolesReady) {
    return (
      <DashboardShell title="Carregando dashboard" description="Validando sua sessão...">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl mt-8" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={`Olá, ${profile?.display_name ?? user?.email ?? ""}`}
      description={
        isAdmin ? "Painel administrativo da comunidade."
        : isRecruiter ? "Sua central de recrutamento."
        : "Sua área pessoal na GALERA DO T.I."
      }
    >
      {!isAdmin && user && <FeaturedEvent userId={user.id} />}
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

/* ===================== FEATURED EVENT ===================== */

function FeaturedEvent({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: ev } = useQuery({
    queryKey: ["featured-event"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("events")
        .select("id,name,theme,event_date,event_time,modality,online_link,address,location_or_link,cover_url,speakers,source")
        .eq("status", "publicado")
        .eq("source", "comunidade")
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const { data: checked } = useQuery({
    queryKey: ["featured-checkin", ev?.id, userId],
    enabled: !!ev?.id,
    queryFn: async () => {
      const { data } = await supabase.from("event_checkins").select("id").eq("event_id", ev!.id).eq("user_id", userId).maybeSingle();
      return !!data;
    },
  });
  if (!ev) return null;
  const link = ev.online_link || (ev.location_or_link?.startsWith("http") ? ev.location_or_link : null);
  const place = ev.address || (!ev.location_or_link?.startsWith("http") ? ev.location_or_link : null);
  const speakers = Array.isArray(ev.speakers) ? ev.speakers : [];

  const checkin = async () => {
    if (checked) {
      const { error } = await supabase.from("event_checkins").delete().eq("event_id", ev.id).eq("user_id", userId);
      if (error) return toast.error(error.message);
      toast.success("Check-in cancelado");
    } else {
      const { error } = await supabase.from("event_checkins").insert({ event_id: ev.id, user_id: userId });
      if (error) return toast.error(error.message);
      toast.success("Check-in confirmado!");
    }
    qc.invalidateQueries({ queryKey: ["featured-checkin"] });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl glass border border-primary/30 p-5 sm:p-6 mb-6">
      <div className="absolute inset-0 bg-gradient-neon opacity-10 pointer-events-none" />
      {ev.cover_url && <img src={ev.cover_url} alt={ev.name} className="absolute inset-0 w-full h-full object-cover opacity-20" loading="lazy" />}
      <div className="relative flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.3em] font-bold text-secondary mb-1">PRÓXIMO EVENTO</div>
          <h3 className="text-xl sm:text-2xl font-black">{ev.name}</h3>
          {ev.theme && <p className="text-sm text-primary mt-1">{ev.theme}</p>}
          <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span><Calendar className="h-3 w-3 inline mr-1" />{formatDateOnly(ev.event_date)}{ev.event_time ? ` • ${ev.event_time.slice(0,5)}` : ""}</span>
            <span className="uppercase">{ev.modality}</span>
            {place && <span><MapPin className="h-3 w-3 inline mr-1" />{place}</span>}
          </div>
          {speakers.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-semibold text-foreground">Palestrantes:</span>{" "}
              {speakers.slice(0, 3).map((s: any) => s.name).filter(Boolean).join(", ")}
              {speakers.length > 3 ? ` +${speakers.length - 3}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {link && <a href={link} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" /> Acessar</Button></a>}
          <Button onClick={checkin} variant={checked ? "default" : "neon"} size="sm">
            <CheckCircle2 className="h-3 w-3 mr-1" /> {checked ? "Check-in feito" : "Fazer check-in"}
          </Button>
        </div>
      </div>
    </div>
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
                  <span className="text-xs text-muted-foreground">{formatDateOnly(e.event_date)}</span>
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
  const [region, setRegion] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<string | null>(null);

  const { data: raw } = useQuery({
    queryKey: ["admin-kpis"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [profiles, jobs, events, projects, checkins] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,gender,birth_date,address_region,address_state,address_city,address_country,address_postal_code")
          .eq("is_blocked", false)
          .limit(2000),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "publicado"),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "publicado").gte("event_date", today),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("event_checkins").select("id", { count: "exact", head: true }),
      ]);
      return {
        profileRows: (profiles.data ?? []) as any[],
        jobs: jobs.count ?? 0,
        events: events.count ?? 0,
        projects: projects.count ?? 0,
        checkins: checkins.count ?? 0,
      };
    },
  });

  const stats = useMemo(() => {
    const rows = raw?.profileRows ?? [];
    const filtered = rows.filter((p: any) => {
      if (region && (p.address_region || "Não informado") !== region) return false;
      if (gender && getGenderLabel(p.gender) !== gender) return false;
      if (age && getAgeRange(p.birth_date) !== age) return false;
      return true;
    });
    const withAddress = filtered.filter((p: any) => p.address_city || p.address_state || p.address_region || p.address_postal_code).length;
    return {
      users: filtered.length,
      totalUsers: rows.length,
      jobs: raw?.jobs ?? 0,
      events: raw?.events ?? 0,
      projects: raw?.projects ?? 0,
      checkins: raw?.checkins ?? 0,
      addressCoverage: filtered.length ? Math.round((withAddress / filtered.length) * 100) : 0,
      regions: countBy(filtered, (p: any) => p.address_region),
      genders: countBy(filtered, (p: any) => getGenderLabel(p.gender)),
      ageRanges: countBy(filtered, (p: any) => getAgeRange(p.birth_date)),
      states: countBy(filtered, (p: any) => p.address_state).slice(0, 8),
      cities: countBy(filtered, (p: any) => p.address_city).slice(0, 8),
    };
  }, [raw, region, gender, age]);

  const activeFilters = [region, gender, age].filter(Boolean).length;

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat icon={Users} label={activeFilters ? `Usuários (filtrado de ${stats?.totalUsers})` : "Usuários ativos"} value={stats?.users ?? "…"} />
        <Stat icon={Briefcase} label="Vagas publicadas" value={stats?.jobs ?? "…"} />
        <Stat icon={Calendar} label="Eventos próximos" value={stats?.events ?? "…"} />
        <Stat icon={FolderKanban} label="Projetos ativos" value={stats?.projects ?? "…"} />
        <Stat icon={CheckCircle2} label="Check-ins totais" value={stats?.checkins ?? "…"} />
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

      <Section
        title="Métricas da comunidade"
        action={
          activeFilters > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => { setRegion(null); setGender(null); setAge(null); }}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros ({activeFilters})
            </Button>
          ) : null
        }
      >
        <div className="glass rounded-xl p-4 border border-primary/20 mb-4">
          <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground mb-2">FILTROS RÁPIDOS — clique nas barras para filtrar</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {region && <FilterChip label={`Região: ${region}`} onClear={() => setRegion(null)} />}
            {gender && <FilterChip label={`Gênero: ${gender}`} onClear={() => setGender(null)} />}
            {age && <FilterChip label={`Faixa: ${age}`} onClear={() => setAge(null)} />}
            {!region && !gender && !age && <span className="text-muted-foreground">Nenhum filtro aplicado.</span>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DistributionCard title="Regiões" items={stats?.regions ?? []} total={stats?.users ?? 0} active={region} onPick={setRegion} />
          <DistributionCard title="Sexo / gênero" items={stats?.genders ?? []} total={stats?.users ?? 0} active={gender} onPick={setGender} />
          <DistributionCard title="Faixa etária" items={stats?.ageRanges ?? []} total={stats?.users ?? 0} active={age} onPick={setAge} />
          <DistributionCard title="Estados" items={stats?.states ?? []} total={stats?.users ?? 0} />
          <DistributionCard title="Cidades" items={stats?.cities ?? []} total={stats?.users ?? 0} />
          <div className="glass rounded-xl p-5 border border-primary/20">
            <div className="text-[10px] tracking-[0.25em] text-muted-foreground font-bold">PERFIS COM ENDEREÇO</div>
            <div className="text-4xl font-black text-gradient-neon mt-3">{stats?.addressCoverage ?? "…"}%</div>
            <p className="text-xs text-muted-foreground mt-2">Baseado em CEP, cidade, estado ou região preenchidos.</p>
          </div>
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

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
      {label}
      <button type="button" onClick={onClear} className="hover:text-destructive"><X className="h-3 w-3" /></button>
    </span>
  );
}

function DistributionCard({ title, items, total, active, onPick }: { title: string; items: { label: string; value: number }[]; total: number; active?: string | null; onPick?: (label: string) => void }) {
  const visible = items.length > 0 ? items.slice(0, 6) : [{ label: "Sem dados", value: 0 }];
  return (
    <div className="glass rounded-xl p-5 border border-primary/20">
      <h3 className="text-sm font-bold mb-4">{title}</h3>
      <div className="space-y-3">
        {visible.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isActive = active === item.label;
          const clickable = !!onPick && item.value > 0;
          return (
            <div
              key={item.label}
              onClick={clickable ? () => onPick!(isActive ? "" as any : item.label) : undefined}
              className={clickable ? "cursor-pointer group" : ""}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <span className={`truncate ${isActive ? "text-primary font-bold" : "text-muted-foreground group-hover:text-foreground"}`}>{item.label}</span>
                <span className="font-bold text-foreground">{item.value} · {pct}%</span>
              </div>
              <div className={`h-1.5 rounded-full bg-muted/50 overflow-hidden ${isActive ? "ring-1 ring-primary" : ""}`}>
                <div className="h-full bg-gradient-neon transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {onPick && active && (
        <button type="button" onClick={() => onPick("" as any)} className="text-[10px] text-muted-foreground hover:text-primary mt-3">
          Limpar filtro
        </button>
      )}
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
