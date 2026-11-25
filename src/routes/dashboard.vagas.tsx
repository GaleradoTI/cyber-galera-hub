import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive, Briefcase, ChevronLeft, ChevronRight, CircleDashed, Copy, Eye, EyeOff, LayoutGrid, Link2, MapPin,
  MoreHorizontal, PauseCircle, Pencil, Plus, Rocket, Search, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles, useAmbassadorCan } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobDetailDialog } from "@/components/public/job-detail-dialog";
import { JobEditor, type JobDraft } from "@/components/jobs/job-editor";
import { EmptyState, StatTile, TagList } from "@/components/jobs/shared";
import { JOB_STATUS, MODALITY, SENIORITY, TYPE_META, timeAgo, useJobApplicants } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/vagas")({
  validateSearch: (s: Record<string, unknown>): { nova?: boolean } => (s.nova ? { nova: true } : {}),
  component: VagasAdminPage,
});

type Job = JobDraft & {
  id: string; title: string; company: string; description: string; status: string; created_at: string;
  created_by?: string | null; seniority: string; modality: string;
};

const empty: JobDraft = { title: "", company: "", description: "", short_description: "", seniority: "pleno", modality: "remoto", location: "", apply_url: "", technologies: [], status: "rascunho", application_type: "interna" };
const PAGE_SIZE = 9;

function VagasAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { nova } = Route.useSearch();
  const { isAdmin, isRecruiter, isAmbassador, user, rolesReady } = useDashboardRoles();
  const { can, ready: areasReady } = useAmbassadorCan();
  const isAmbassadorArea = isAmbassador && can("vagas");
  const [editing, setEditing] = useState<JobDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Job | null>(null);
  const [removing, setRemoving] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Quem não é admin, recrutador ou embaixador de vagas só indica vagas externas.
  const ready = rolesReady && areasReady;
  const isMemberOnly = ready && !isAdmin && !isRecruiter && !isAmbassadorArea;
  const forcedType = isAdmin || isAmbassadorArea ? null : isRecruiter ? "interna" as const : "externa" as const;
  const seesApplicants = isAdmin || isRecruiter;
  const canCreate = isRecruiter || isMemberOnly || can("vagas", "criar");
  const canPublish = !isMemberOnly && (isRecruiter || can("vagas", "publicar"));
  const canEdit = (j: Job) => isRecruiter || (isMemberOnly && j.status === "rascunho") || can("vagas", "editar");
  const canRemove = (j: Job) => isRecruiter || (isMemberOnly && j.status === "rascunho") || can("vagas", "remover");

  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: ["admin-jobs", isAdmin ? "all" : user?.id],
    enabled: !!user?.id && ready,
    queryFn: async () => {
      let q = supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (!isAdmin && !isAmbassadorArea && user) q = q.eq("created_by", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Job[];
    },
  });

  const { data: applicants = [] } = useJobApplicants(!!user?.id && seesApplicants);
  const applicantsByJob = useMemo(() => {
    const map: Record<string, { total: number; fresh: number }> = {};
    applicants.forEach((a) => {
      const item = (map[a.job_id] ??= { total: 0, fresh: 0 });
      item.total++;
      if (a.status === "enviada") item.fresh++;
    });
    return map;
  }, [applicants]);

  // Para o admin saber quem enviou cada vaga ainda em rascunho.
  const authorIds = Array.from(new Set(jobs.filter((j) => j.status === "rascunho" && j.created_by && j.created_by !== user?.id).map((j) => j.created_by as string))).sort();
  const { data: authors = {} } = useQuery({
    queryKey: ["job-authors", authorIds.join(",")],
    enabled: isAdmin && authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,display_name").in("user_id", authorIds);
      return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.display_name])) as Record<string, string>;
    },
  });

  const openNew = () => setEditing({ ...empty, company: jobs.find((j) => j.created_by === user?.id)?.company ?? "" });

  // Atalho "Publicar vaga" (?nova=1): abre o formulário quando os papéis já carregaram.
  useEffect(() => {
    if (!nova || !ready || isLoading || !canCreate) return;
    openNew();
    navigate({ to: "/dashboard/vagas", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nova, ready, isLoading, canCreate]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-jobs"] });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    jobs.forEach((j) => { c[j.status] = (c[j.status] ?? 0) + 1; });
    return c;
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (modalityFilter !== "all" && j.modality !== modalityFilter) return false;
      return !q || [j.title, j.company, ...(j.technologies ?? [])].some((v) => v?.toLowerCase().includes(q));
    });
  }, [jobs, search, statusFilter, modalityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, statusFilter, modalityFilter]);

  const save = async (draft: JobDraft) => {
    const payload: any = {
      title: draft.title?.trim(), company: draft.company?.trim(), description: draft.description,
      short_description: draft.short_description || null, seniority: draft.seniority, modality: draft.modality,
      location: draft.location || null, apply_url: draft.application_type === "externa" ? draft.apply_url?.trim() : null,
      technologies: draft.technologies ?? [], status: isMemberOnly ? "rascunho" : draft.status,
      application_type: draft.application_type,
    };
    setSaving(true);
    const { error } = draft.id
      ? await supabase.from("jobs").update(payload).eq("id", draft.id)
      : await supabase.from("jobs").insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isMemberOnly ? "Vaga enviada para aprovação da administração" : payload.status === "publicado" ? "Vaga salva e visível no site" : "Vaga salva");
    setEditing(null);
    refresh();
  };

  const setStatus = async (job: Job, status: "publicado" | "pausado" | "encerrado", message: string) => {
    const { error } = await supabase.from("jobs").update({ status }).eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success(message);
    refresh();
  };

  const duplicate = (job: Job) => {
    const { id: _id, created_at: _c, created_by: _b, ...copy } = job;
    setEditing({ ...copy, title: `${job.title} (cópia)`, status: "rascunho" });
  };

  const copyLink = (job: Job) => navigator.clipboard.writeText(`${window.location.origin}/vagas?vaga=${job.id}`)
    .then(() => toast.success("Link da vaga copiado"), () => toast.error("Não foi possível copiar"));

  const remove = async () => {
    if (!removing) return;
    const { error } = await supabase.from("jobs").delete().eq("id", removing.id);
    if (error) return toast.error(error.message);
    toast.success("Vaga removida");
    setRemoving(null);
    refresh();
  };

  const tabs = [
    { key: "all", label: "Todas", icon: LayoutGrid },
    { key: "publicado", label: "Publicadas", icon: Eye },
    { key: "rascunho", label: isMemberOnly ? "Em aprovação" : "Rascunhos", icon: CircleDashed },
    { key: "pausado", label: "Pausadas", icon: PauseCircle },
    { key: "encerrado", label: "Encerradas", icon: Archive },
  ];

  return (
    <DashboardShell
      title={isMemberOnly ? "Indicar vaga" : isAdmin ? "Vagas" : "Minhas vagas"}
      description={isMemberOnly ? "Indique vagas externas. Elas aparecem no site depois de aprovadas pela administração." : "Publique, acompanhe candidaturas e gerencie suas oportunidades."}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {tabs.map((t) => <StatTile key={t.key} icon={t.icon} label={t.label} value={isLoading ? "…" : counts[t.key] ?? 0} active={statusFilter === t.key} onClick={() => setStatusFilter(t.key)} />)}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar título, empresa ou tecnologia" className="pl-9" />
        </div>
        <Select value={modalityFilter} onValueChange={setModalityFilter}>
          <SelectTrigger className="w-[180px]" aria-label="Modalidade"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            {Object.entries(MODALITY).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canCreate && <Button variant="neon" onClick={openNew} className="ml-auto"><Plus className="h-4 w-4 mr-1" /> {isMemberOnly ? "Indicar vaga" : "Publicar vaga"}</Button>}
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>}
      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState icon={Briefcase} title={jobs.length === 0 ? "Nenhuma vaga ainda" : "Nenhuma vaga com esses filtros"} text={jobs.length === 0 ? "Publique em três etapas, com prévia antes de ir ao ar." : undefined}>
          {jobs.length === 0 && canCreate
            ? <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Criar a primeira vaga</Button>
            : <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); setModalityFilter("all"); }}>Limpar filtros</Button>}
        </EmptyState>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {paginated.map((j) => {
          const status = JOB_STATUS[j.status] ?? JOB_STATUS.rascunho;
          const mod = MODALITY[j.modality];
          const level = SENIORITY[j.seniority];
          const type = TYPE_META[j.application_type ?? "interna"] ?? TYPE_META.interna;
          const stats = applicantsByJob[j.id] ?? { total: 0, fresh: 0 };
          // Contagem de candidatos só faz sentido para as vagas que a pessoa consegue ler.
          const showApplicants = j.application_type !== "externa" && (isAdmin || (isRecruiter && j.created_by === user?.id));
          return (
            <article key={j.id} className="glass rounded-xl border border-primary/20 p-4 flex flex-col gap-3 hover:border-primary/50 transition">
              <div className="flex items-start justify-between gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold", status.className)}><status.icon className="h-3 w-3" /> {status.label}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Mais ações para ${j.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewing(j)}><Eye className="h-4 w-4 mr-2" /> Visualizar</DropdownMenuItem>
                    {j.status === "publicado" && <DropdownMenuItem onClick={() => copyLink(j)}><Link2 className="h-4 w-4 mr-2" /> Copiar link</DropdownMenuItem>}
                    {canCreate && <DropdownMenuItem onClick={() => duplicate(j)}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>}
                    {canPublish && j.status !== "encerrado" && <DropdownMenuItem onClick={() => setStatus(j, "encerrado", "Vaga encerrada")}><Archive className="h-4 w-4 mr-2" /> Encerrar vaga</DropdownMenuItem>}
                    {canRemove(j) && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoving(j)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem></>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold leading-snug line-clamp-2">{j.title}</h2>
                <p className="text-sm text-muted-foreground truncate">{j.company}</p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {mod && <span className="inline-flex items-center gap-1"><mod.icon className="h-3.5 w-3.5" /> {mod.label}</span>}
                {level && <span className="inline-flex items-center gap-1"><level.icon className="h-3.5 w-3.5" /> {level.label}</span>}
                {j.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {j.location}</span>}
                <span className="inline-flex items-center gap-1"><type.icon className="h-3.5 w-3.5" /> {type.label}</span>
              </div>
              <TagList tags={j.technologies} />
              <div className="mt-auto space-y-3 border-t border-border/40 pt-3">
                {showApplicants && (
                  <Link to="/dashboard/candidatos" search={{ vaga: j.id }} className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm hover:border-primary">
                    <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {stats.total} candidato(s)</span>
                    {stats.fresh > 0 ? <span className="rounded-full bg-secondary/20 px-2 text-[11px] font-bold text-secondary">{stats.fresh} nova(s)</span> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </Link>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground truncate">Criada {timeAgo(j.created_at)}{j.status === "rascunho" && j.created_by && authors[j.created_by] ? ` · por ${authors[j.created_by]}` : ""}</span>
                  <div className="flex gap-1 shrink-0">
                    {canEdit(j) && <Button size="sm" variant="ghost" onClick={() => setEditing(j)}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>}
                    {canPublish && (j.status === "publicado"
                      ? <Button size="sm" variant="outline" onClick={() => setStatus(j, "pausado", "Vaga pausada: saiu do site")}><EyeOff className="h-3.5 w-3.5 mr-1" /> Pausar</Button>
                      : <Button size="sm" onClick={() => setStatus(j, "publicado", "Vaga publicada")}><Rocket className="h-3.5 w-3.5 mr-1" /> Publicar</Button>)}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-5 text-sm">
          <div className="text-muted-foreground">{filtered.length} vaga(s) — página {currentPage} de {totalPages}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" aria-label="Próxima página" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {editing && (
        <JobEditor key={editing.id ?? "nova"} initial={editing} forcedType={forcedType} isMemberOnly={isMemberOnly}
          canPublish={canPublish} saving={saving} onClose={() => setEditing(null)} onSave={save} />
      )}

      <JobDetailDialog job={viewing} open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vaga?</AlertDialogTitle>
            <AlertDialogDescription>
              "{removing?.title}" será removida permanentemente{removing && applicantsByJob[removing.id]?.total ? `, junto com ${applicantsByJob[removing.id].total} candidatura(s)` : " e as candidaturas recebidas"}. Para só tirar do site, use Pausar ou Encerrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
