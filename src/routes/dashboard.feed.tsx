import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, CheckCircle2, ExternalLink, LayoutGrid, Loader2, Newspaper, Rss, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUploader } from "@/components/ui/image-uploader";
import { EmptyState } from "@/components/brand/ui-kit";
import { PersonAvatar } from "@/components/jobs/shared";
import { FeedPostCard, isPinned, type FeedPost } from "@/components/feed/feed-post";
import { useLoadMore } from "@/hooks/use-load-more";
import { usePeople, handle } from "@/lib/people";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/feed")({ component: FeedPage });

const PAGE_SIZE = 8;
type Filter = "all" | "news" | "community";
type Cursor = { created_at: string; id: string } | null;

const FILTERS: { key: Filter; label: string; icon: typeof Rss }[] = [
  { key: "all", label: "Tudo", icon: LayoutGrid },
  { key: "news", label: "Notícias", icon: Newspaper },
  { key: "community", label: "Da galera", icon: Users },
];

function FeedPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useDashboardRoles();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [publishing, setPublishing] = useState(false);
  const links = useMemo(() => extractLinks(content), [content]);

  const { data: me } = useQuery({
    queryKey: ["my-mini-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle()).data as any,
  });

  // Notícias fixadas ficam no topo e não se repetem na rolagem.
  const { data: pinned = [] } = useQuery({
    queryKey: ["member-feed", "pinned"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_feed_posts").select("*").eq("status", "published")
        .gt("pinned_until", new Date().toISOString()).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  // Paginação pelo último item visto: posts novos não duplicam nem pulam itens.
  const feed = useInfiniteQuery({
    queryKey: ["member-feed", "pages", filter],
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      let query = supabase.from("member_feed_posts").select("*").eq("status", "published")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE);
      if (filter === "news") query = query.eq("kind", "news");
      if (filter === "community") query = query.neq("kind", "news");
      if (pageParam) query = query.or(`created_at.lt."${pageParam.created_at}",and(created_at.eq."${pageParam.created_at}",id.lt.${pageParam.id})`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
    getNextPageParam: (last): Cursor | undefined => (last.length < PAGE_SIZE ? undefined : { created_at: last[last.length - 1].created_at, id: last[last.length - 1].id }),
  });

  const posts = useMemo(() => {
    const top = filter === "community" ? [] : pinned.filter(isPinned);
    const ids = new Set(top.map((p) => p.id));
    return [...top, ...(feed.data?.pages.flat() ?? []).filter((p) => !ids.has(p.id))];
  }, [pinned, feed.data, filter]);

  const sourceIds = useMemo(() => Array.from(new Set(posts.map((p) => p.reposted_from_id).filter((x): x is string => !!x))).sort(), [posts]);
  const { data: sources = new Map<string, FeedPost>() } = useQuery({
    queryKey: ["feed-repost-sources", sourceIds.join(",")],
    enabled: sourceIds.length > 0,
    placeholderData: (previous: Map<string, FeedPost> | undefined) => previous,
    queryFn: async () => {
      const { data } = await supabase.from("member_feed_posts").select("*").in("id", sourceIds);
      return new Map(((data ?? []) as unknown as FeedPost[]).map((p) => [p.id, p]));
    },
  });

  const people = usePeople([...posts.map((p) => p.author_id), ...Array.from(sources.values()).map((p) => p.author_id)]);

  const canAutoLoad = !!feed.hasNextPage && !feed.isFetchingNextPage && !feed.isError;
  const sentinel = useLoadMore(() => { feed.fetchNextPage(); }, canAutoLoad);

  // Volta para a primeira página, sem recarregar tudo o que já tinha sido rolado.
  const restart = () => {
    qc.resetQueries({ queryKey: ["member-feed", "pages"] });
    qc.invalidateQueries({ queryKey: ["member-feed", "pinned"] });
  };

  const publish = async () => {
    if (!user?.id || publishing) return;
    if (content.trim().length < 2) return toast.error("Escreva algo antes de publicar.");
    setPublishing(true);
    const { error } = await supabase.from("member_feed_posts")
      .insert({ author_id: user.id, content: content.trim(), links, images, status: "published", kind: "user" } as any);
    setPublishing(false);
    if (error) return toast.error(error.message);
    toast.success("Publicado no feed.");
    setContent("");
    setImages([]);
    restart();
  };

  const remove = async (post: FeedPost) => {
    if (!confirm("Remover este post?")) return;
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
    const { error } = await supabase.from("member_feed_posts")
      .insert({ author_id: user.id, content: "", links: [], status: "published", kind: "repost", reposted_from_id: post.reposted_from_id ?? post.id });
    if (error) return toast.error(error.message);
    toast.success("Repostado!");
    qc.invalidateQueries({ queryKey: ["feed-repost-count"] });
    restart();
  };

  return (
    <DashboardShell title="Feed da Galera" description="Compartilhe ideias, links e conquistas com a comunidade.">
      <div className="mx-auto max-w-2xl">
        <section className="glass rounded-2xl border border-primary/25 p-4 mb-4">
          <div className="flex gap-3">
            <PersonAvatar name={me?.display_name ?? "Eu"} url={me?.avatar_url} className="hidden sm:flex" />
            <div className="min-w-0 flex-1">
              {me?.nickname && <p className="text-[11px] text-secondary">{handle(me.nickname)}</p>}
              <Textarea rows={2} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} aria-label="Escrever post"
                placeholder={`O que está rolando${me?.display_name ? `, ${me.display_name.split(" ")[0]}` : ""}?`}
                className="resize-none border-0 bg-transparent px-0 text-base focus-visible:ring-0 min-h-[56px]" />
              {images.length > 0 && (
                <div className={cn("grid gap-2 mt-2", images.length > 1 && "grid-cols-2 sm:grid-cols-4")}>
                  {images.map((src) => (
                    <div key={src} className="relative">
                      <img src={src} alt="" className="w-full h-28 sm:h-24 object-cover rounded-xl border border-border/50" />
                      <button type="button" aria-label="Remover imagem" onClick={() => setImages((prev) => prev.filter((i) => i !== src))} className="absolute top-1 right-1 rounded-full bg-background/90 border border-border p-1"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              {links.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {links.map((l) => <Badge key={l.url} variant="outline" className="text-[10px]"><ExternalLink className="h-3 w-3 mr-1" /> {l.url.replace(/^https?:\/\//, "").slice(0, 28)}</Badge>)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 pt-3 border-t border-border/30">
                {user?.id && images.length < 4
                  ? <ImageUploader compact compactLabel="Adicionar foto ao post" bucket="avatars" folder={`${user.id}/feed`} value={null} onChange={(url) => { if (url) setImages((prev) => [...prev, url].slice(0, 4)); }} label="" />
                  : <span className="text-[11px] text-muted-foreground">Máximo de 4 imagens</span>}
                <span className={cn("text-[11px] tabular-nums", content.length > 1800 ? "text-secondary" : "text-muted-foreground")}>{content.length}/2000</span>
                <Button onClick={publish} size="sm" variant="neon" className="ml-auto rounded-full px-5" disabled={content.trim().length < 2 || publishing}>
                  {publishing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Publicar
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar o feed">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition", filter === f.key ? "border-primary bg-primary/15 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/50")}>
              <f.icon className="h-4 w-4" /> {f.label}
            </button>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto shrink-0" onClick={() => { restart(); window.scrollTo({ top: 0, behavior: "smooth" }); }}><ArrowUp className="h-4 w-4 mr-1" /> Atualizar</Button>
        </div>

        {feed.isLoading ? (
          <div className="space-y-3" role="status" aria-label="Carregando o feed">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <FeedPostCard key={post.id} post={post} source={post.reposted_from_id ? sources.get(post.reposted_from_id) ?? null : null}
                people={people} currentUserId={user?.id ?? null} isAdmin={!!isAdmin} canRemove={isAdmin || post.author_id === user?.id}
                onRemove={() => remove(post)} onRepost={() => repost(post)} />
            ))}
            {posts.length === 0 && !feed.isError && <EmptyState icon={Rss} title="Nada por aqui ainda" text={filter === "all" ? "Seja a primeira pessoa a publicar." : "Tente outro filtro."} />}
          </div>
        )}

        <div ref={sentinel} className="py-6 text-center text-sm text-muted-foreground" aria-live="polite">
          {feed.isFetchingNextPage ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando mais…</span>
          ) : feed.isError ? (
            <span className="space-y-2 block"><span className="block text-destructive">Não foi possível carregar o feed.</span><Button size="sm" variant="outline" onClick={() => (posts.length ? feed.fetchNextPage() : feed.refetch())}>Tentar novamente</Button></span>
          ) : feed.hasNextPage ? (
            <Button size="sm" variant="outline" onClick={() => feed.fetchNextPage()}>Carregar mais</Button>
          ) : posts.length > 0 ? (
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Você chegou ao fim</span>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

function extractLinks(text: string) {
  return Array.from(new Set((text.match(/https?:\/\/[^\s]+/g) ?? []).map((url) => url.replace(/[),.;!?]+$/, ""))))
    .slice(0, 5)
    .map((url) => ({ url }));
}
