import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Heart, MessageCircle, Newspaper, Pin, Repeat2, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/dashboard/follow-button";
import { FeedCommentsDialog, timeAgo, useCommentCount } from "@/components/dashboard/feed-comments";
import { PersonAvatar } from "@/components/jobs/shared";
import { RichText, prettyUrl } from "@/lib/rich-text";
import { handle, type PublicPerson } from "@/lib/people";
import { cn } from "@/lib/utils";

export type FeedPost = {
  id: string; author_id: string; content: string; title: string | null; cover_url: string | null;
  images: string[] | null; links: { url: string; label?: string }[]; status: string; created_at: string;
  kind: "user" | "news" | "repost"; pinned_until: string | null; reposted_from_id: string | null;
};

export const isPinned = (p: Pick<FeedPost, "pinned_until">) => !!p.pinned_until && new Date(p.pinned_until) > new Date();

const nameOf = (person?: PublicPerson) => person?.display_name || "Membro";

function Author({ person, date, size = "md" }: { person?: PublicPerson; date: string; size?: "md" | "sm" }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <PersonAvatar name={nameOf(person)} url={person?.avatar_url} className={size === "sm" ? "h-7 w-7 text-[10px]" : "h-11 w-11"} />
      <div className="min-w-0">
        <p className={cn("font-bold leading-tight truncate", size === "sm" ? "text-xs" : "text-sm")}>{nameOf(person)}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {person?.nickname && <span className="text-secondary">{handle(person.nickname)} · </span>}
          <time dateTime={date} title={new Date(date).toLocaleString("pt-BR")}>{timeAgo(date)}</time>
        </p>
      </div>
    </div>
  );
}

function Images({ images }: { images: string[] }) {
  if (!images.length) return null;
  return (
    <div className={cn("grid gap-1.5 mt-3 overflow-hidden rounded-xl", images.length > 1 && "grid-cols-2")}>
      {images.map((src, i) => (
        <a key={src} href={src} target="_blank" rel="noreferrer" className={cn("block overflow-hidden", images.length === 3 && i === 0 && "col-span-2")}>
          <img src={src} alt="" loading="lazy" decoding="async"
            className={cn("w-full object-cover transition duration-300 hover:scale-[1.02]", images.length === 1 ? "max-h-[28rem]" : "h-44 sm:h-56")} />
        </a>
      ))}
    </div>
  );
}

export function FeedPostCard({ post, source, people, currentUserId, isAdmin, canRemove, onRemove, onRepost }: {
  post: FeedPost; source: FeedPost | null; people: Map<string, PublicPerson>; currentUserId: string | null;
  isAdmin: boolean; canRemove: boolean; onRemove: () => void; onRepost: () => void;
}) {
  const author = people.get(post.author_id);
  const links = Array.isArray(post.links) ? post.links : [];
  const isNews = post.kind === "news";

  return (
    <article className={cn("glass rounded-2xl border overflow-hidden transition hover:border-primary/40", isNews ? "border-secondary/50" : "border-border/40")}>
      {isNews && post.cover_url && <img src={post.cover_url} alt={post.title ?? ""} loading="lazy" decoding="async" className="w-full max-h-72 object-cover" />}
      {isNews && (
        <div className="flex items-center gap-2 border-b border-secondary/20 bg-secondary/10 px-4 py-2 text-[10px] font-bold tracking-[0.25em] text-secondary">
          <Newspaper className="h-3.5 w-3.5" /> NOTÍCIA OFICIAL
          {isPinned(post) && <span className="ml-auto inline-flex items-center gap-1"><Pin className="h-3 w-3" /> FIXADA</span>}
        </div>
      )}
      <div className="p-4">
        {post.kind === "repost" && <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Repeat2 className="h-3.5 w-3.5 text-secondary" /> {nameOf(author)} repostou</p>}
        <div className="flex items-start justify-between gap-3">
          <Author person={author} date={post.created_at} />
          <div className="flex items-center gap-1 shrink-0">
            {post.author_id !== currentUserId && !isNews && <FollowButton userId={post.author_id} />}
            {canRemove && <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remover post" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>

        {isNews && post.title && <h2 className="mt-3 text-xl font-black leading-snug text-gradient-neon">{post.title}</h2>}
        {post.content && <RichText text={post.content} className="mt-3 text-[15px] leading-relaxed text-foreground/90 break-words" />}
        <Images images={post.images ?? []} />

        {post.kind === "repost" && (source ? (
          <div className="mt-3 rounded-xl border border-border/50 bg-muted/10 p-3">
            <Author person={people.get(source.author_id)} date={source.created_at} size="sm" />
            {source.title && <p className="mt-2 text-sm font-bold">{source.title}</p>}
            {source.content && <RichText text={source.content} className="mt-1 text-sm text-foreground/80 break-words" />}
            <Images images={source.images ?? []} />
          </div>
        ) : <p className="mt-3 rounded-xl border border-dashed border-border/50 p-3 text-xs text-muted-foreground">O post original não está mais disponível.</p>)}

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-primary hover:bg-primary/10 max-w-full">
                <ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{l.label || prettyUrl(l.url)}</span>
              </a>
            ))}
          </div>
        )}

        <PostActions post={post} currentUserId={currentUserId} isAdmin={isAdmin} onRepost={onRepost} />
      </div>
    </article>
  );
}

type Reaction = { id: string; post_id: string; user_id: string; emoji: string };
const EMOJIS = ["👍", "❤️", "🔥", "🎉", "👏", "🤯"];

function PostActions({ post, currentUserId, isAdmin, onRepost }: { post: FeedPost; currentUserId: string | null; isAdmin: boolean; onRepost: () => void }) {
  const qc = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const commentCount = useCommentCount(post.id);

  const { data: reactions = [] } = useQuery({
    queryKey: ["feed-reactions", post.id],
    queryFn: async () => ((await supabase.from("feed_post_reactions").select("*").eq("post_id", post.id)).data ?? []) as Reaction[],
  });
  const { data: repostCount = 0 } = useQuery({
    queryKey: ["feed-repost-count", post.id],
    queryFn: async () => (await supabase.from("member_feed_posts").select("id", { count: "exact", head: true }).eq("reposted_from_id", post.id).neq("status", "deleted")).count ?? 0,
  });

  const mine = currentUserId ? reactions.find((r) => r.user_id === currentUserId) ?? null : null;
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    reactions.forEach((r) => map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [reactions]);

  const react = async (emoji: string) => {
    if (!currentUserId) return toast.error("Entre para reagir.");
    setShowPicker(false);
    const { error } = mine?.emoji === emoji
      ? await supabase.from("feed_post_reactions").delete().eq("id", mine.id)
      : mine
        ? await supabase.from("feed_post_reactions").update({ emoji }).eq("id", mine.id)
        : await supabase.from("feed_post_reactions").insert({ post_id: post.id, user_id: currentUserId, emoji });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["feed-reactions", post.id] });
  };

  const action = "h-9 flex-1 gap-1.5 rounded-lg text-xs";
  return (
    <div className="mt-4 border-t border-border/30 pt-2">
      {grouped.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {grouped.map(([emoji, count]) => (
            <button key={emoji} type="button" onClick={() => react(emoji)} aria-label={`Reagir com ${emoji}`} aria-pressed={mine?.emoji === emoji}
              className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition", mine?.emoji === emoji ? "border-primary/70 bg-primary/15 text-primary" : "border-border/50 hover:border-primary/40")}>
              <span>{emoji}</span><span className="tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      )}
      <div className="relative flex items-center gap-1 text-muted-foreground">
        <Button size="sm" variant="ghost" onClick={() => react(mine?.emoji ?? "❤️")} className={cn(action, mine && "text-primary")}>
          {mine ? <span className="text-sm leading-none">{mine.emoji}</span> : <Heart className="h-4 w-4" />}<span>{reactions.length || "Curtir"}</span>
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setShowPicker((v) => !v)} aria-label="Escolher reação" aria-expanded={showPicker}><SmilePlus className="h-4 w-4" /></Button>
        {showPicker && (
          <div className="absolute bottom-10 left-0 z-20 flex gap-1 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur">
            {EMOJIS.map((e) => <button key={e} type="button" onClick={() => react(e)} className="text-xl leading-none transition hover:scale-125" aria-label={`Reagir com ${e}`}>{e}</button>)}
          </div>
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpenComments(true)} className={action}><MessageCircle className="h-4 w-4" /><span>{commentCount || "Comentar"}</span></Button>
        <Button size="sm" variant="ghost" onClick={onRepost} className={action} disabled={!currentUserId}><Repeat2 className="h-4 w-4" /><span>{repostCount || "Repostar"}</span></Button>
      </div>
      {openComments && (
        <FeedCommentsDialog postId={post.id} open={openComments} onOpenChange={setOpenComments} currentUserId={currentUserId} isAdmin={isAdmin}
          header={post.content || post.title ? <div className="text-sm text-foreground/80">{post.title && <div className="font-bold mb-1">{post.title}</div>}<RichText text={post.content} className="text-sm" /></div> : null} />
      )}
    </div>
  );
}
