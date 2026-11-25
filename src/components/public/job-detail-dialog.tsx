import { useEffect, useState } from "react";
import { Briefcase, ExternalLink, Heart, MapPin, CheckCircle2, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ReportButton } from "@/components/dashboard/report-button";
import { MarkdownView } from "@/components/ui/markdown-editor";
import { Textarea } from "@/components/ui/textarea";
import { db, safeLink, MISSING_FIELD_LABEL } from "@/lib/resume";

export function JobDetailDialog({ job, open, onOpenChange }: { job: any | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, isAuthenticated } = useAuth();
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => { setMissing([]); setMessage(""); }, [job?.id, open]);

  useEffect(() => {
    if (!job || !user) { setSaved(false); setApplied(false); return; }
    supabase.from("saved_jobs").select("id").eq("user_id", user.id).eq("job_id", job.id).maybeSingle()
      .then(({ data }) => setSaved(!!data));
    supabase.from("job_applications").select("id").eq("user_id", user.id).eq("job_id", job.id).maybeSingle()
      .then(({ data }) => setApplied(!!data));
  }, [job, user]);

  if (!job) return null;

  const toggleSave = async () => {
    if (!user) return;
    setBusy(true);
    if (saved) {
      const { error } = await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", job.id);
      if (error) toast.error(error.message); else { setSaved(false); toast.success("Vaga removida"); }
    } else {
      const { error } = await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: job.id });
      if (error) toast.error(error.message); else { setSaved(true); toast.success("Vaga salva"); }
    }
    setBusy(false);
  };

  const external = job.application_type === "externa";
  const externalUrl = external ? safeLink(job.apply_url) : null;
  const ownJob = !!user && job.created_by === user.id;

  const apply = async () => {
    if (!user) return;
    setBusy(true);
    const check = await db.rpc("my_missing_application_fields");
    if (check.error) { setBusy(false); return toast.error(check.error.message); }
    if ((check.data ?? []).length > 0) { setBusy(false); setMissing(check.data); return; }
    const { error } = await supabase.from("job_applications").insert({ user_id: user.id, job_id: job.id, message: message.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setApplied(true);
    toast.success("Candidatura registrada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Briefcase className="h-5 w-5 text-secondary" /> {job.title}
          </DialogTitle>
          <DialogDescription>{job.company}{job.location ? ` • ${job.location}` : ""}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{job.modality}</span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">{job.seniority}</span>
          {job.location && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/30 border border-border/40 inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {job.location}
            </span>
          )}
        </div>

        {job.short_description && <p className="text-sm text-muted-foreground">{job.short_description}</p>}
        {job.description && (
          <MarkdownView className="text-sm leading-relaxed">{job.description}</MarkdownView>
        )}

        {(job.technologies ?? []).length > 0 && (
          <div>
            <div className="text-xs font-bold tracking-wider uppercase text-muted-foreground mb-2">Tecnologias</div>
            <div className="flex flex-wrap gap-1.5">
              {job.technologies.map((t: string) => (
                <span key={t} className="text-xs px-2 py-1 rounded bg-accent/40">{t}</span>
              ))}
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div className="rounded-lg border border-secondary/40 bg-secondary/10 p-3 text-sm">
            <p className="font-bold">Complete seu currículo para se candidatar:</p>
            <ul className="list-disc pl-5 my-1">{missing.map((m) => <li key={m}>{MISSING_FIELD_LABEL[m] ?? m}</li>)}</ul>
            <Button asChild size="sm" className="mt-1"><Link to="/dashboard/curriculo">Completar ou importar currículo</Link></Button>
          </div>
        )}
        {!external && isAuthenticated && !applied && !ownJob && (
          <div>
            <Textarea rows={2} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem para o recrutador (opcional)" />
            <p className="text-[11px] text-muted-foreground mt-1">Ao se candidatar, seu contato e currículo são compartilhados com o responsável pela vaga e a administração.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
          {!external && !isAuthenticated && (
            <Button asChild variant="neon" className="flex-1 min-w-[180px]"><Link to="/login">Entrar para se candidatar</Link></Button>
          )}
          {!external && isAuthenticated && !ownJob && (
            applied ? (
              <Button variant="default" disabled className="flex-1 min-w-[180px]">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Candidatura enviada
              </Button>
            ) : (
              <Button variant="neon" onClick={apply} disabled={busy} className="flex-1 min-w-[180px]">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Candidatar-se
              </Button>
            )
          )}
          {externalUrl && (
            <Button asChild variant="neon" className="flex-1 min-w-[180px]">
              <a href={externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Candidatar-se no site da vaga</a>
            </Button>
          )}
          {isAuthenticated ? (
            <Button variant={saved ? "default" : "outline"} onClick={toggleSave} disabled={busy}>
              <Heart className={`h-4 w-4 mr-2 ${saved ? "fill-current" : ""}`} />
              {saved ? "Salva" : "Salvar vaga"}
            </Button>
          ) : (
            <Link to="/login"><Button variant="outline"><Heart className="h-4 w-4 mr-2" /> Entrar para salvar</Button></Link>
          )}
          {job.status === "publicado" && (
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/vagas?vaga=${job.id}`).then(() => toast.success("Link da vaga copiado"), () => toast.error("Não foi possível copiar"))}>
              <Share2 className="h-4 w-4 mr-2" /> Copiar link
            </Button>
          )}
          {isAuthenticated && <ReportButton entityType="job" entityId={job.id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}