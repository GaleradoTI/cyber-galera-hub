/**
 * Identidade visual compartilhada. Use estes blocos em telas novas:
 * IconTile (ícone da página), PageHero (topo público), StatTile, EmptyState e LoadingState.
 */
import type { ReactNode } from "react";
import { Inbox, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-neon p-[1.5px]", className)}>
      <span className="flex h-full w-full items-center justify-center rounded-[10px] bg-background/90 text-secondary">
        <Icon className="h-5 w-5" />
      </span>
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-bold uppercase tracking-[0.3em] text-secondary", className)}>{children}</p>;
}

/** Topo padrão das telas públicas. `aside` recebe o mascote. */
export function PageHero({ icon, eyebrow, title, description, aside, actions }: {
  icon: LucideIcon; eyebrow: ReactNode; title: ReactNode; description?: ReactNode; aside?: ReactNode; actions?: ReactNode;
}) {
  return (
    <header className={cn("grid items-center gap-8", aside && "lg:grid-cols-[minmax(0,1fr)_240px]")}>
      <div className="min-w-0">
        <div className="flex items-start gap-4">
          <IconTile icon={icon} className="mt-1 h-14 w-14" />
          <div className="min-w-0">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="mt-1 text-3xl md:text-5xl font-black tracking-tight break-words">{title}</h1>
          </div>
        </div>
        {description && <p className="mt-4 max-w-2xl text-muted-foreground">{description}</p>}
        <div aria-hidden className="mt-5 h-1 w-24 rounded-full bg-gradient-neon" />
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {aside}
    </header>
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

export function EmptyState({ icon: Icon = Inbox, title, text, children, compact }: {
  icon?: LucideIcon; title: string; text?: string; children?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={cn("w-full text-center", compact ? "px-2 py-4" : "glass rounded-xl border border-dashed border-primary/30 p-10")}>
      <Icon className={cn("mx-auto text-primary/70", compact ? "h-5 w-5" : "h-9 w-9")} />
      <p className={cn(compact ? "mt-1.5 text-sm text-muted-foreground" : "mt-3 font-bold")}>{title}</p>
      {text && <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{text}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Carregando…", compact }: { label?: string; compact?: boolean }) {
  return (
    <div role="status" className={cn("flex w-full items-center justify-center gap-2 text-muted-foreground", compact ? "py-4 text-xs" : "py-12 text-sm")}>
      <Loader2 className={cn("animate-spin text-primary", compact ? "h-4 w-4" : "h-5 w-5")} /> {label}
    </div>
  );
}
