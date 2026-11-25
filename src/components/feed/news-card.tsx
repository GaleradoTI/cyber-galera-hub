import type { ReactNode } from "react";
import { ArrowRight, Newspaper, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type NewsItem = {
  title: string | null; content: string; cover_url: string | null; pinned_until: string | null; created_at: string; status: string;
};

/** Cartão de notícia no estilo de revista; `actions` aparece para quem gerencia. */
export function NewsCard({ news, featured = false, onOpen, actions }: { news: NewsItem; featured?: boolean; onOpen: () => void; actions?: ReactNode }) {
  const pinned = !!news.pinned_until && new Date(news.pinned_until) > new Date();
  const minutes = Math.max(1, Math.round(news.content.split(/\s+/).length / 200));
  return (
    <article className={cn("glass flex flex-col overflow-hidden rounded-2xl border transition hover:border-secondary/60", featured ? "md:flex-row border-secondary/40" : "border-border/40")}>
      <button type="button" onClick={onOpen} aria-label={`Ler ${news.title ?? "notícia"}`}
        className={cn("relative shrink-0 overflow-hidden bg-muted", featured ? "h-56 md:h-auto md:w-1/2 md:min-h-[17rem]" : "h-40")}>
        {news.cover_url
          ? <img src={news.cover_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105" />
          : <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-gradient-neon/30"><Newspaper className="h-10 w-10 text-secondary" /></span>}
      </button>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2 p-4", featured && "md:p-6")}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {pinned && <Badge className="bg-secondary/20 text-secondary border-secondary/40"><Pin className="h-3 w-3 mr-1" />Fixada</Badge>}
          {news.status === "draft" && <Badge variant="outline">Rascunho</Badge>}
          <time dateTime={news.created_at}>{new Date(news.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</time>
          <span>· {minutes} min de leitura</span>
        </div>
        <h2 className={cn("font-black leading-snug", featured ? "text-2xl md:text-3xl text-gradient-neon" : "text-lg line-clamp-2")}>{news.title}</h2>
        <p className={cn("text-sm text-muted-foreground", featured ? "line-clamp-4" : "line-clamp-3")}>{news.content}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:gap-2 transition-all">Ler notícia <ArrowRight className="h-4 w-4" /></button>
          {actions && <div className="flex gap-1">{actions}</div>}
        </div>
      </div>
    </article>
  );
}
