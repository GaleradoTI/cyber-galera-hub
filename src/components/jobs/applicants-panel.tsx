import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Download, Inbox, KanbanSquare, List, MessageSquareText, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandidateDialog } from "@/components/jobs/candidate-dialog";
import { EmptyState, PersonAvatar, StatTile, TagList } from "@/components/jobs/shared";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { PIPELINE, timeAgo, useJobApplicants, type Applicant } from "@/lib/jobs";
import { APPLICATION_STATUS } from "@/lib/resume";
import { cn } from "@/lib/utils";

const NEXT_STEP: Record<string, { to: string; label: string } | undefined> = {
  enviada: { to: "em_analise", label: "Analisar" },
  em_analise: { to: "contratado", label: "Contratar" },
};

/** Quem se candidatou às vagas internas (recrutador: as próprias; admin: todas). */
export function ApplicantsPanel({ job, onJobChange }: { job: string; onJobChange: (id: string) => void }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"quadro" | "lista">("quadro");
  const { data = [], isLoading, error } = useJobApplicants();

  const jobs = useMemo(() => Array.from(new Map(data.map((a) => [a.job_id, `${a.job_title} — ${a.company}`])).entries()), [data]);
  const ofJob = job === "all" ? data : data.filter((a) => a.job_id === job);
  const q = search.trim().toLowerCase();
  const matching = ofJob.filter((a) => !q || [a.display_name, a.work_area, ...(a.tech_tags ?? [])].some((v) => v?.toLowerCase().includes(q)));
  const visible = stage === "all" ? matching : matching.filter((a) => a.status === stage);
  const selected = data.find((a) => a.application_id === selectedId);

  const setStatus = async (id: string, status: string) => {
    // contratar ou dispensar avisa a pessoa, então pede confirmação
    if ((status === "contratado" || status === "rejeitada") && !confirm(`Marcar como "${APPLICATION_STATUS[status]}"? A pessoa será avisada.`)) return;
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Etapa atualizada. A pessoa foi avisada.");
    qc.invalidateQueries({ queryKey: ["job-applicants"] });
  };

  const exportCsv = () => {
    if (!visible.length) return toast.info("Nada a exportar.");
    downloadCSV(`candidaturas-${new Date().toISOString().slice(0, 10)}.csv`, visible.map((a) => ({
      nome: a.display_name, vaga: a.job_title, empresa: a.company, etapa: APPLICATION_STATUS[a.status] ?? a.status,
      area: a.work_area ?? "", conhecimentos: (a.tech_tags ?? []).join("; "), mensagem: a.message ?? "",
      recebida_em: new Date(a.created_at).toLocaleDateString("pt-BR"),
    })));
  };

  const statusSelect = (a: Applicant) => (
    <Select value={a.status} onValueChange={(v) => setStatus(a.application_id, v)}>
      <SelectTrigger className="w-[170px] h-8 text-xs" aria-label={`Etapa de ${a.display_name}`}><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(APPLICATION_STATUS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
    </Select>
  );

  const card = (a: Applicant, compact: boolean) => {
    const next = NEXT_STEP[a.status];
    return (
      <article key={a.application_id} className={cn("glass rounded-xl border border-primary/20 p-3 hover:border-primary/50 transition", !compact && "sm:flex sm:items-center sm:gap-4")}>
        <button type="button" onClick={() => setSelectedId(a.application_id)} className="flex items-start gap-3 text-left min-w-0 flex-1 w-full">
          <PersonAvatar name={a.display_name} url={a.avatar_url} />
          <span className="min-w-0 flex-1">
            <span className="block font-bold truncate">{a.display_name}</span>
            <span className="block text-xs text-muted-foreground truncate">{a.work_area || "Área não informada"}</span>
            <span className="block text-[11px] text-muted-foreground truncate">{job === "all" ? `${a.job_title} · ` : ""}{timeAgo(a.created_at)}</span>
          </span>
          {a.message && <MessageSquareText className="h-4 w-4 shrink-0 text-secondary" aria-label="Enviou mensagem" />}
        </button>
        <div className={cn("mt-2", !compact && "sm:mt-0 sm:max-w-[220px]")}><TagList tags={a.tech_tags} max={3} /></div>
        <div className={cn("mt-3 flex items-center justify-between gap-2", !compact && "sm:mt-0 sm:justify-end")}>
          {compact ? <Button size="sm" variant="ghost" onClick={() => setSelectedId(a.application_id)}>Ver perfil</Button> : statusSelect(a)}
          {next && <Button size="sm" variant="outline" onClick={() => setStatus(a.application_id, next.to)}>{next.label} <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>}
        </div>
      </article>
    );
  };

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (isLoading) return <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  if (data.length === 0) return <EmptyState icon={Inbox} title="Nenhuma candidatura recebida ainda" text="Quando alguém se candidatar a uma vaga interna, aparece aqui com o perfil completo." />;

  const columns = stage === "all" ? PIPELINE : PIPELINE.filter((p) => p.key === stage);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PIPELINE.map((p) => (
          <StatTile key={p.key} icon={p.icon} label={p.label} value={matching.filter((a) => a.status === p.key).length}
            active={stage === p.key} onClick={() => setStage(stage === p.key ? "all" : p.key)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Nome, área ou tecnologia" />
        </div>
        <Select value={job} onValueChange={onJobChange}>
          <SelectTrigger className="w-full sm:w-[300px]" aria-label="Vaga"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todas as vagas</SelectItem>
            {jobs.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
            {job !== "all" && !jobs.some(([id]) => id === job) && <SelectItem value={job}>Vaga sem candidaturas</SelectItem>}
          </SelectContent>
        </Select>
        <div className="flex gap-1 ml-auto">
          <Button size="sm" variant={view === "quadro" ? "default" : "outline"} aria-pressed={view === "quadro"} onClick={() => setView("quadro")}><KanbanSquare className="h-4 w-4 mr-1" /> Quadro</Button>
          <Button size="sm" variant={view === "lista" ? "default" : "outline"} aria-pressed={view === "lista"} onClick={() => setView("lista")}><List className="h-4 w-4 mr-1" /> Lista</Button>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Search} title="Ninguém com esses filtros">
          <Button variant="outline" onClick={() => { setStage("all"); setSearch(""); onJobChange("all"); }}>Limpar filtros</Button>
        </EmptyState>
      ) : view === "lista" ? (
        <div className="space-y-2">{visible.map((a) => card(a, false))}</div>
      ) : (
        <div className={cn("grid gap-3 items-start", columns.length > 1 && "md:grid-cols-2 2xl:grid-cols-4")}>
          {columns.map((p) => {
            const items = visible.filter((a) => a.status === p.key);
            return (
              <section key={p.key} className="rounded-xl border border-border/40 bg-muted/10 p-2">
                <h3 className="flex items-center gap-2 px-1 pb-2 text-sm font-bold"><p.icon className="h-4 w-4 text-primary" /> {p.label}<span className="ml-auto rounded-full bg-muted px-2 text-xs">{items.length}</span></h3>
                <div className="space-y-2">
                  {items.map((a) => card(a, true))}
                  {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Vazio</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <CandidateDialog
        userId={selected?.user_id ?? null}
        onClose={() => setSelectedId(null)}
        footer={selected && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="font-bold">Candidatura para {selected.job_title}</p>
            <p className="text-xs text-muted-foreground">Recebida {timeAgo(selected.created_at)}</p>
            {selected.message && <blockquote className="border-l-2 border-secondary pl-3 whitespace-pre-line">{selected.message}</blockquote>}
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Etapa:</span>{statusSelect(selected)}</div>
          </div>
        )}
      />
    </div>
  );
}
