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

export { StatTile, EmptyState } from "@/components/brand/ui-kit";
