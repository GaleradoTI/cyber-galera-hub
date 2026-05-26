import { useEffect, useState } from "react";
import { Briefcase, ExternalLink, Heart, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function JobDetailDialog({ job, open, onOpenChange }: { job: any | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, isAuthenticated } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job || !user) { setSaved(false); return; }
    supabase.from("saved_jobs").select("id").eq("user_id", user.id).eq("job_id", job.id).maybeSingle()
      .then(({ data }) => setSaved(!!data));
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
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{job.description}</div>
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

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
          {job.apply_url && (
            <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[180px]">
              <Button variant="neon" className="w-full"><ExternalLink className="h-4 w-4 mr-2" /> Candidatar-se</Button>
            </a>
          )}
          {isAuthenticated ? (
            <Button variant={saved ? "default" : "outline"} onClick={toggleSave} disabled={busy}>
              <Heart className={`h-4 w-4 mr-2 ${saved ? "fill-current" : ""}`} />
              {saved ? "Salva" : "Salvar vaga"}
            </Button>
          ) : (
            <Link to="/login"><Button variant="outline"><Heart className="h-4 w-4 mr-2" /> Entrar para salvar</Button></Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}