import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Briefcase, ChevronRight, Inbox, MessageSquare, Plus, Sparkles, UserSearch, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateDialog } from "@/components/jobs/candidate-dialog";
import { EmptyState, PersonAvatar, StatTile } from "@/components/jobs/shared";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE, timeAgo, useJobApplicants } from "@/lib/jobs";
import { APPLICATION_STATUS } from "@/lib/resume";

export function RecruiterHome({ userId }: { userId: string }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const jobsQuery = useQuery({
    queryKey: ["rec-jobs", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("id,title,company,status").eq("created_by", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const appsQuery = useJobApplicants();
  const jobs = jobsQuery.data ?? [];
  // Admin que também é recrutador recebe tudo da função; aqui ficam só as próprias vagas.
  const mine = new Set(jobs.map((j) => j.id));
  const apps = (appsQuery.data ?? []).filter((a) => mine.has(a.job_id));
  const waiting = apps.filter((a) => a.status === "enviada");
  const week = apps.filter((a) => Date.now() - new Date(a.created_at).getTime() < 7 * 86_400_000).length;
  const published = jobs.filter((j) => j.status === "publicado");

  const error = (jobsQuery.error ?? appsQuery.error) as Error | null;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (jobsQuery.isLoading || appsQuery.isLoading) return <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;

  if (jobs.length === 0) {
    return (
      <EmptyState icon={Briefcase} title="Publique sua primeira vaga" text="São três etapas, com prévia antes de ir ao ar. As candidaturas chegam aqui com perfil e currículo.">
        <Button asChild variant="neon"><Link to="/dashboard/vagas" search={{ nova: true }}><Plus className="h-4 w-4 mr-1" /> Publicar vaga</Link></Button>
        <Button asChild variant="outline"><Link to="/dashboard/candidatos"><UserSearch className="h-4 w-4 mr-1" /> Ver banco de talentos</Link></Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="neon"><Link to="/dashboard/vagas" search={{ nova: true }}><Plus className="h-4 w-4 mr-1" /> Publicar vaga</Link></Button>
        <Button asChild variant="outline"><Link to="/dashboard/candidatos"><Users className="h-4 w-4 mr-1" /> Candidatos</Link></Button>
        <Button asChild variant="ghost"><Link to="/dashboard/mensagens"><MessageSquare className="h-4 w-4 mr-1" /> Mensagens</Link></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Briefcase} label="Vagas no ar" value={published.length} hint={`${jobs.length} no total`} />
        <StatTile icon={Users} label="Candidaturas" value={apps.length} hint="em todas as suas vagas" />
        <StatTile icon={Sparkles} label="Últimos 7 dias" value={week} hint="candidaturas recebidas" />
        <StatTile icon={AlertCircle} label="Aguardando você" value={waiting.length} hint="ainda sem análise" />
      </div>

      <section className="glass rounded-xl border border-primary/20 p-4">
        <h2 className="font-bold text-sm mb-3">Funil de seleção</h2>
        <div className="space-y-2">
          {PIPELINE.map((p) => {
            const n = apps.filter((a) => a.status === p.key).length;
            return (
              <div key={p.key} className="grid grid-cols-[150px_1fr_32px] items-center gap-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><p.icon className="h-4 w-4 text-primary" /> {p.label}</span>
                <div className="h-2.5 rounded-full bg-muted"><div className="h-2.5 rounded-full bg-gradient-neon" style={{ width: `${apps.length ? (n / apps.length) * 100 : 0}%` }} /></div>
                <span className="text-right font-bold tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <section className="glass rounded-xl border border-primary/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">Candidaturas recentes</h2>
            <Link to="/dashboard/candidatos" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {apps.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center"><Inbox className="h-6 w-6 mx-auto mb-1" /> Nada por aqui ainda.</p>}
          <ul className="divide-y divide-border/40">
            {apps.slice(0, 5).map((a) => (
              <li key={a.application_id}>
                <button type="button" onClick={() => setViewing(a.user_id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:text-primary">
                  <PersonAvatar name={a.display_name} url={a.avatar_url} className="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{a.display_name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{a.job_title} · {timeAgo(a.created_at)}</span>
                  </span>
                  <span className="text-[11px] rounded-full border border-border px-2 py-0.5 shrink-0">{APPLICATION_STATUS[a.status] ?? a.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass rounded-xl border border-primary/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">Vagas no ar</h2>
            <Link to="/dashboard/vagas" className="text-xs text-primary hover:underline">Gerenciar</Link>
          </div>
          {published.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma vaga publicada no momento.</p>}
          <ul className="space-y-2">
            {published.slice(0, 5).map((j) => (
              <li key={j.id}>
                <Link to="/dashboard/candidatos" search={{ vaga: j.id }} className="flex items-center gap-3 rounded-lg border border-border/40 p-2.5 hover:border-primary">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary"><Briefcase className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{j.title}</span><span className="block text-xs text-muted-foreground truncate">{j.company}</span></span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {apps.filter((a) => a.job_id === j.id).length}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <CandidateDialog userId={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
