import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandidateDialog } from "@/components/jobs/candidate-dialog";
import { supabase } from "@/integrations/supabase/client";
import { APPLICATION_STATUS, db } from "@/lib/resume";

type Applicant = {
  application_id: string; job_id: string; job_title: string; company: string; status: string; message: string | null;
  created_at: string; user_id: string; display_name: string; avatar_url: string | null; work_area: string | null;
};

/** Quem se candidatou às vagas internas (recrutador: as próprias; admin: todas). */
export function ApplicantsPanel() {
  const qc = useQueryClient();
  const [job, setJob] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["job-applicants"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_job_applicants");
      if (error) throw error;
      return (data ?? []) as Applicant[];
    },
  });

  const jobs = useMemo(() => Array.from(new Map(data.map((a) => [a.job_id, `${a.job_title} — ${a.company}`])).entries()), [data]);
  const filtered = job === "all" ? data : data.filter((a) => a.job_id === job);
  const selected = data.find((a) => a.application_id === selectedId);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["job-applicants"] });
  };

  const statusSelect = (a: Applicant) => (
    <Select value={a.status} onValueChange={(v) => setStatus(a.application_id, v)}>
      <SelectTrigger className="w-[160px] h-9" aria-label="Status da candidatura"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(APPLICATION_STATUS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
    </Select>
  );

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={job} onValueChange={setJob}>
          <SelectTrigger className="w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todas as vagas</SelectItem>
            {jobs.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} candidatura(s)</span>
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma candidatura recebida ainda.</p>}
      {filtered.map((a) => (
        <div key={a.application_id} className="glass rounded-xl p-4 border border-primary/20 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold truncate">{a.display_name}</div>
            <div className="text-xs text-muted-foreground truncate">{a.job_title} — {a.company} · {new Date(a.created_at).toLocaleDateString("pt-BR")}</div>
            {a.message && <p className="text-sm mt-1 line-clamp-2">“{a.message}”</p>}
          </div>
          <div className="flex items-center gap-2">
            {statusSelect(a)}
            <Button size="sm" onClick={() => setSelectedId(a.application_id)}>Ver perfil</Button>
          </div>
        </div>
      ))}
      <CandidateDialog
        userId={selected?.user_id ?? null}
        onClose={() => setSelectedId(null)}
        footer={selected && (
          <div className="border-t border-border/40 pt-3 space-y-2">
            <p className="font-bold">Candidatura para {selected.job_title}</p>
            {selected.message && <p className="text-muted-foreground whitespace-pre-line">{selected.message}</p>}
            {statusSelect(selected)}
          </div>
        )}
      />
    </div>
  );
}
