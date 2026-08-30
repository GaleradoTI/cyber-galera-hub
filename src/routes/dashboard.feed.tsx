import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink, Send, Trash2, MessageCircle, Heart, Repeat2, Pin, Newspaper, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "@/components/dashboard/follow-button";
import { RichText, prettyUrl } from "@/lib/rich-text";
import { ImageUploader } from "@/components/ui/image-uploader";
import { FeedCommentsDialog, useCommentCount } from "@/components/dashboard/feed-comments";

export const Route = createFileRoute("/dashboard/feed")({ component: FeedPage });

type FeedPost = {
  id: string;
  author_id: string;
  content: string;
  title: string | null;
  cover_url: string | null;
  images: string[] | null;
  links: { url: string; label?: string }[];
  status: string;
  created_at: string;
  kind: "user" | "news" | "repost";
  pinned_until: string | null;
  reposted_from_id: string | null;
};

type Profile = { user_id: string; display_name: string | null; avatar_url: string | null; email: string | null };

function FeedPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useDashboardRoles();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const links = useMemo(() => extractLinks(content), [content]);

  const { data: posts = [] as FeedPost[], isLoading } = useQuery({
    queryKey: ["member-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_feed_posts")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = ((data ?? []) as unknown) as FeedPost[];
      const now = Date.now();
      // Ordenação: notícias fixadas > outras notícias recentes > cronológico
      rows.sort((a, b) => {
        const pinA = a.pinned_until && new Date(a.pinned_until).getTime() > now ? 1 : 0;
        const pinB = b.pinned_until && new Date(b.pinned_until).getTime() > now ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return rows;
    },
  });

  const authorIds = useMemo(
    () => Array.from(new Set(posts.map((p) => p.author_id))),
    [posts],
  );
  const repostSourceIds = useMemo(
    () => posts.map((p) => p.reposted_from_id).filter((x): x is string => !!x),
    [posts],
  );

  const { data: profileMap = new Map<string, Profile>() } = useQuery({
    queryKey: ["feed-profiles", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url,email")
        .in("user_id", authorIds);
      return new Map((data ?? []).map((p: any) => [p.user_id, p as Profile]));
    },
  });

  const { data: sourcePosts = new Map<string, FeedPost>() } = useQuery({
    queryKey: ["feed-repost-sources", repostSourceIds.join(",")],
    enabled: repostSourceIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_feed_posts")
        .select("*")
        .in("id", repostSourceIds);
      return new Map((((data ?? []) as unknown) as FeedPost[]).map((p) => [p.id, p]));
    },
  });

  const publish = async () => {
    if (!user?.id) return;
    if (content.trim().length < 2) return toast.error("Escreva algo antes de publicar.");
    if (content.length > 2000) return toast.error("O post pode ter no máximo 2000 caracteres.");
    const { error } = await supabase
      .from("member_feed_posts")
      .insert({ author_id: user.id, content: content.trim(), links, images, status: "published", kind: "user" } as any);
    if (error) return toast.error(error.message);
    toast.success("Publicado no feed.");
    setContent("");
    setImages([]);
    qc.invalidateQueries({ queryKey: ["member-feed"] });
  };

  const remove = async (post: FeedPost) => {
    const own = post.author_id === user?.id;
    const { error } = own && !isAdmin
      ? await supabase.from("member_feed_posts").update({ status: "deleted" }).eq("id", post.id).eq("author_id", user!.id)
      : await supabase.from("member_feed_posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Post removido.");
    qc.invalidateQueries({ queryKey: ["member-feed"] });
  };

  const repost = async (post: FeedPost) => {
    if (!user?.id) return;
    const sourceId = post.reposted_from_id ?? post.id;
    const { error } = await supabase.from("member_feed_posts").insert({
      author_id: user.id,
      content: "",
      links: [],
      status: "published",
      kind: "repost",
      reposted_from_id: sourceId,
    });
    if (error) return toast.error(error.message);
    toast.success("Repostado!");
    qc.invalidateQueries({ queryKey: ["member-feed"] });
  };

  return (
    <DashboardShell title="Feed da Galera" description="Compartilhe textos, links, curta, comente e reposte.">
      <section className="glass rounded-xl border border-primary/20 p-4 mb-5">
        <Textarea
          rows={3}
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva uma atualização, dica, link ou novidade…"
        />
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {images.map((src) => (
              <div key={src} className="relative">
                <img src={src} alt="" className="w-full h-24 object-cover rounded-lg border border-border/50" />
                <button
                  type="button"
                  aria-label="Remover imagem"
                  onClick={() => setImages((prev) => prev.filter((i) => i !== src))}
                  className="absolute top-1 right-1 rounded-full bg-background/90 border border-border p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {user?.id && images.length < 4 && (
          <div className="mt-3">
            <ImageUploader
              bucket="avatars"
              folder={`${user.id}/feed`}
              value={null}
              onChange={(url) => { if (url) setImages((prev) => [...prev, url].slice(0, 4)); }}
              label="Adicionar foto"
              hint="Até 4 imagens por post."
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <div className="flex flex-wrap gap-1">
            {links.map((l) => (
              <Badge key={l.url} variant="outline" className="text-[10px]">
                <ExternalLink className="h-3 w-3 mr-1" /> {l.url.replace(/^https?:\/\//, "").slice(0, 28)}
              </Badge>
            ))}
          </div>
          <Button onClick={publish} className="ml-auto"><Send className="h-4 w-4 mr-1" /> Publicar</Button>
        </div>
      </section>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              source={post.reposted_from_id ? (sourcePosts as Map<string, FeedPost>).get(post.reposted_from_id) ?? null : null}
              profileMap={profileMap as Map<string, Profile>}
              currentUserId={user?.id ?? null}
              isAdmin={!!isAdmin}
              canRemove={isAdmin || post.author_id === user?.id}
              onRemove={() => remove(post)}
              onRepost={() => repost(post)}
            />
          ))}
          {posts.length === 0 && (
            <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhum post ainda.</div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

function extractLinks(text: string) {
  return Array.from(
    new Set((text.match(/https?:\/\/[^\s]+/g) ?? []).map((url) => url.replace(/[),.;!?]+$/, ""))),
  )
    .slice(0, 5)
    .map((url) => ({ url }));
}

function PostCard({
  post,
  source,
  profileMap,
  currentUserId,
  isAdmin,
  canRemove,
  onRemove,
  onRepost,
}: {
  post: FeedPost;
  source: FeedPost | null;
  profileMap: Map<string, Profile>;
  currentUserId: string | null;
  isAdmin: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onRepost: () => void;
}) {
  const author = profileMap.get(post.author_id);
  const name = author?.display_name || author?.email || "Membro";
  const links = Array.isArray(post.links) ? post.links : [];
  const isNews = post.kind === "news";
  const isRepost = post.kind === "repost";
  const pinned = post.pinned_until && new Date(post.pinned_until) > new Date();

  return (
    <article
      className={`glass rounded-xl border p-4 ${
        isNews
          ? "border-secondary/60 shadow-[0_0_24px_hsl(var(--secondary)/0.15)]"
          : "border-border/40"
      }`}
    >
      {isNews && (
        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold tracking-[0.25em] text-secondary">
          <Newspaper className="h-3 w-3" /> NOTÍCIA OFICIAL
          {pinned && (
            <span className="inline-flex items-center gap-1 text-secondary/80"><Pin className="h-3 w-3" /> FIXADA</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={author?.avatar_url ?? undefined} alt={name} />
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <h2 className="text-sm font-bold truncate">{name}</h2>
            <span className="text-[10px] text-muted-foreground">
              {new Date(post.created_at).toLocaleString("pt-BR")}
            </span>
            {isRepost && (
              <Badge variant="outline" className="text-[10px]"><Repeat2 className="h-3 w-3 mr-1" />Repost</Badge>
            )}
          </div>
          {post.author_id !== currentUserId && !isNews && (
            <div className="mt-1"><FollowButton userId={post.author_id} /></div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canRemove && (
            <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isNews && post.title && <h3 className="text-lg font-black text-gradient-neon mt-3">{post.title}</h3>}
      {isNews && post.cover_url && (
        <img src={post.cover_url} alt={post.title ?? ""} className="rounded-lg w-full max-h-64 object-cover mt-3" />
      )}

      {post.content && (
        <RichText text={post.content} className="text-sm text-foreground/90 mt-3" />
      )}

      {(post.images ?? []).length > 0 && (
        <div className={`grid gap-2 mt-3 ${(post.images ?? []).length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {(post.images ?? []).map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="" loading="lazy" className="rounded-lg w-full max-h-72 object-cover border border-border/40" />
            </a>
          ))}
        </div>
      )}

      {isRepost && source && (
        <RepostedInline post={source} profile={profileMap.get(source.author_id) ?? null} />
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-primary hover:bg-primary/10 max-w-full"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{l.label || prettyUrl(l.url)}</span>
            </a>
          ))}
        </div>
      )}

      <PostActions post={post} currentUserId={currentUserId} isAdmin={isAdmin} onRepost={onRepost} />
    </article>
  );
}

function RepostedInline({ post, profile }: { post: FeedPost; profile: Profile | null }) {
  const name = profile?.display_name || profile?.email || "Membro";
  return (
    <div className="mt-3 rounded-lg border border-border/40 p-3 bg-muted/10">
      <div className="flex items-center gap-2 mb-1">
        <Avatar className="h-6 w-6"><AvatarImage src={profile?.avatar_url ?? undefined} /><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
        <span className="text-xs font-semibold">{name}</span>
        <span className="text-[10px] text-muted-foreground">{new Date(post.created_at).toLocaleString("pt-BR")}</span>
      </div>
      {post.title && <div className="text-sm font-bold">{post.title}</div>}
      <p className="text-xs whitespace-pre-wrap text-foreground/80">{post.content}</p>
    </div>
  );
}

type Reaction = { id: string; post_id: string; user_id: string; emoji: string };

const EMOJIS = ["👍", "❤️", "🔥", "🎉", "👏", "🤯"];

function PostActions({
  post,
  currentUserId,
  isAdmin,
  onRepost,
}: {
  post: FeedPost;
  currentUserId: string | null;
  isAdmin: boolean;
  onRepost: () => void;
}) {
  const qc = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const commentCount = useCommentCount(post.id);

  const { data: reactions = [] } = useQuery({
    queryKey: ["feed-reactions", post.id],
    queryFn: async () => {
      const { data } = await supabase.from("feed_post_reactions").select("*").eq("post_id", post.id);
      return (data ?? []) as Reaction[];
    },
  });

  const { data: repostCount = 0 } = useQuery({
    queryKey: ["feed-repost-count", post.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("member_feed_posts")
        .select("id", { count: "exact", head: true })
        .eq("reposted_from_id", post.id)
        .neq("status", "deleted");
      return count ?? 0;
    },
  });

  const myReaction = currentUserId ? reactions.find((r) => r.user_id === currentUserId) ?? null : null;
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reactions) map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [reactions]);

  const react = async (emoji: string) => {
    if (!currentUserId) return toast.error("Entre para reagir.");
    setShowPicker(false);
    if (myReaction?.emoji === emoji) {
      const { error } = await supabase.from("feed_post_reactions").delete().eq("id", myReaction.id);
      if (error) return toast.error(error.message);
    } else if (myReaction) {
      const { error } = await supabase.from("feed_post_reactions").update({ emoji }).eq("id", myReaction.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("feed_post_reactions")
        .insert({ post_id: post.id, user_id: currentUserId, emoji });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["feed-reactions", post.id] });
  };

  return (
    <div className="mt-3 pt-2 border-t border-border/30">
      {grouped.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {grouped.map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                myReaction?.emoji === emoji
                  ? "border-primary/70 bg-primary/15 text-primary"
                  : "border-border/50 hover:border-primary/40"
              }`}
              aria-label={`Reagir com ${emoji}`}
            >
              <span>{emoji}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative flex items-center justify-between gap-1 text-muted-foreground">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => react(myReaction?.emoji ?? "❤️")}
          className={`h-8 flex-1 text-xs gap-1.5 ${myReaction ? "text-primary" : ""}`}
        >
          {myReaction ? (
            <span className="text-sm leading-none">{myReaction.emoji}</span>
          ) : (
            <Heart className="h-4 w-4" />
          )}
          <span>{reactions.length > 0 ? reactions.length : "Curtir"}</span>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => setShowPicker((v) => !v)}
          aria-label="Escolher reação"
        >
          <SmilePlus className="h-4 w-4" />
        </Button>

        {showPicker && (
          <div className="absolute bottom-9 left-0 z-20 flex gap-1 rounded-full border border-border/60 bg-background/95 px-2 py-1 shadow-lg backdrop-blur">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                className="text-lg leading-none transition hover:scale-125"
                aria-label={`Reagir com ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpenComments(true)}
          className="h-8 flex-1 text-xs gap-1.5"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{commentCount > 0 ? commentCount : "Comentar"}</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onRepost}
          className="h-8 flex-1 text-xs gap-1.5"
          disabled={!currentUserId}
        >
          <Repeat2 className="h-4 w-4" />
          <span>{repostCount > 0 ? repostCount : "Repostar"}</span>
        </Button>
      </div>

      <FeedCommentsDialog
        postId={post.id}
        open={openComments}
        onOpenChange={setOpenComments}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        header={
          post.content || post.title ? (
            <div className="text-sm text-foreground/80">
              {post.title && <div className="font-bold mb-1">{post.title}</div>}
              <RichText text={post.content} className="text-sm" />
            </div>
          ) : null
        }
      />
    </div>
  );
}
