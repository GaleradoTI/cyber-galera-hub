import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PersonAvatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const base = cn("h-11 w-11 shrink-0 rounded-full ring-2 ring-primary/30", className);
  if (url) return <img src={url} alt="" loading="lazy" className={cn(base, "object-cover")} />;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return <div aria-hidden className={cn(base, "flex items-center justify-center bg-gradient-to-br from-primary to-secondary text-sm font-black text-background")}>{initials}</div>;
}

export function TagList({ tags, max = 4 }: { tags?: string[] | null; max?: number }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, max).map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">{t}</span>)}
      {tags.length > max && <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground" title={tags.slice(max).join(", ")}>+{tags.length - max}</span>}
    </div>
  );
}

/** Cartão de número com ícone; vira botão quando recebe onClick. */
export function StatTile({ icon: Icon, label, value, hint, active, onClick }: {
  icon: LucideIcon; label: string; value: number | string; hint?: string; active?: boolean; onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="rounded-lg bg-primary/10 p-1.5 text-primary"><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </>
  );
  const cls = cn("glass rounded-xl border p-4 text-left w-full", active ? "border-primary bg-primary/5" : "border-primary/15");
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={active} className={cn(cls, "transition hover:border-primary/60")}>{content}</button>
    : <div className={cls}>{content}</div>;
}

export function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="glass rounded-xl border border-dashed border-primary/30 p-10 text-center">
      <Icon className="h-9 w-9 mx-auto text-primary/70" />
      <p className="mt-3 font-bold">{title}</p>
      {text && <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{text}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
