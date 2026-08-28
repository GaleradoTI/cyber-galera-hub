import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Send, Trash2, MessageCircle, Heart, Repeat2, Pin, Newspaper, SmilePlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "@/components/dashboard/follow-button";
import { RichText, prettyUrl } from "@/lib/rich-text";

export const Route = createFileRoute("/dashboard/feed")({ component: FeedPage });

type FeedPost = {
  id: string;
  author_id: string;
  content: string;
  title: string | null;
  cover_url: string | null;
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
      .insert({ author_id: user.id, content: content.trim(), links, status: "published", kind: "user" });
    if (error) return toast.error(error.message);
    toast.success("Publicado no feed.");
    setContent("");
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
type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

const EMOJIS = ["👍", "❤️", "🔥", "🎉", "👏", "🤯"];

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

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
  const [showComments, setShowComments] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const { data: reactions = [] } = useQuery({
    queryKey: ["feed-reactions", post.id],
    queryFn: async () => {
      const { data } = await supabase.from("feed_post_reactions").select("*").eq("post_id", post.id);
      return (data ?? []) as Reaction[];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["feed-comments", post.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_post_comments")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at");
      return (data ?? []) as Comment[];
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

  const commenterIds = useMemo(() => Array.from(new Set(comments.map((c) => c.user_id))), [comments]);
  const { data: commenterProfiles = new Map<string, Profile>() } = useQuery({
    queryKey: ["feed-comment-profiles", commenterIds.join(",")],
    enabled: commenterIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url,email")
        .in("user_id", commenterIds);
      return new Map((data ?? []).map((p: any) => [p.user_id, p as Profile]));
    },
  });

  const myReaction = currentUserId ? reactions.find((r) => r.user_id === currentUserId) ?? null : null;
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reactions) map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [reactions]);

  const refreshReactions = () => qc.invalidateQueries({ queryKey: ["feed-reactions", post.id] });

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
    refreshReactions();
  };

  const sendComment = async () => {
    if (!currentUserId) return toast.error("Entre para comentar.");
    const t = commentText.trim();
    if (!t) return;
    const { error } = await supabase
      .from("feed_post_comments")
      .insert({ post_id: post.id, user_id: currentUserId, content: t });
    if (error) return toast.error(error.message);
    setCommentText("");
    qc.invalidateQueries({ queryKey: ["feed-comments", post.id] });
  };

  const saveEdit = async (id: string) => {
    const t = editingText.trim();
    if (!t) return;
    const { error } = await supabase.from("feed_post_comments").update({ content: t }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["feed-comments", post.id] });
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("feed_post_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["feed-comments", post.id] });
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
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

      <div className="flex items-center gap-1 flex-wrap relative">
        <Button
          size="sm"
          variant={myReaction ? "default" : "ghost"}
          onClick={() => react(myReaction?.emoji ?? "👍")}
          className="h-8 text-xs gap-1"
        >
          {myReaction ? <span className="text-sm leading-none">{myReaction.emoji}</span> : <Heart className="h-3.5 w-3.5" />}
          <span>{myReaction ? "Reagiu" : "Curtir"}</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setShowPicker((v) => !v)}
          aria-label="Escolher reação"
        >
          <SmilePlus className="h-3.5 w-3.5" />
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
        <Button size="sm" variant="ghost" onClick={() => setShowComments((v) => !v)} className="h-8 text-xs gap-1">
          <MessageCircle className="h-3.5 w-3.5" />
          <span>{showComments ? "Ocultar" : `Comentar${comments.length ? ` · ${comments.length}` : ""}`}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onRepost} className="h-8 text-xs gap-1" disabled={!currentUserId}>
          <Repeat2 className="h-3.5 w-3.5" />
          <span>Repostar{repostCount > 0 ? ` · ${repostCount}` : ""}</span>
        </Button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-2">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum comentário ainda. Seja o primeiro.</p>
          )}
          {comments.map((c) => {
            const u = (commenterProfiles as Map<string, Profile>).get(c.user_id);
            const name = u?.display_name || u?.email || "Membro";
            const mine = c.user_id === currentUserId;
            const editable = mine;
            const removable = mine || isAdmin;
            return (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={u?.avatar_url ?? undefined} />
                  <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 bg-background/50 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(c.created_at)}
                      {c.updated_at !== c.created_at ? " · editado" : ""}
                    </span>
                  </div>
                  {editingId === c.id ? (
                    <div className="flex gap-1 mt-1">
                      <Input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(c.id); }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button size="sm" className="h-7 px-2" onClick={() => saveEdit(c.id)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-foreground/80 whitespace-pre-wrap break-words">{c.content}</div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {editable && editingId !== c.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => { setEditingId(c.id); setEditingText(c.content); }}
                      aria-label="Editar comentário"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {removable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => deleteComment(c.id)}
                      aria-label="Excluir comentário"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex gap-1">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                  e.preventDefault();
                  sendComment();
                }
              }}
              placeholder="Comentar…"
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8" onClick={sendComment} disabled={!commentText.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}