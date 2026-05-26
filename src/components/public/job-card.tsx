import { Briefcase, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function JobCard({ job, onClick }: { job: any; onClick?: () => void }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-base group-hover:text-gradient-neon transition">{job.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
        </div>
        <Briefcase className="h-4 w-4 text-secondary shrink-0" />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{job.modality}</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">{job.seniority}</span>
      </div>
      {job.location && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
          <MapPin className="h-3 w-3" /> {job.location}
        </div>
      )}
      <div className="flex flex-wrap gap-1 mt-3">
        {(job.technologies ?? []).slice(0, 4).map((t: string) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-accent/40 text-muted-foreground">{t}</span>
        ))}
      </div>
    </>
  );
  const cls = "glass rounded-xl p-5 hover-glow-magenta block group text-left w-full";
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  }
  return (
    <Link to="/vagas" className={cls}>{inner}</Link>
  );
}