import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/dashboard/feed")({ component: FeedPage });

type FeedPost = {
  id: string;
  author_id: string;
  content: string;
  links: { url: string }[];
  status: string;
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null; email: string | null } | null;
};

function FeedPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useDashboardRoles();
  const [content, setContent] = useState("");
  const links = useMemo(() => extractLinks(content), [content]);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["member-feed"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("member_feed_posts")
        .select("*, profiles:author_id(display_name,avatar_url,email)")
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
  });

  const publish = async () => {
    if (!user?.id) return;
    if (content.trim().length < 2) return toast.error("Escreva algo antes de publicar.");
    if (content.length > 2000) return toast.error("O post pode ter no máximo 2000 caracteres.");
    const { error } = await supabase.from("member_feed_posts").insert({ author_id: user.id, content: content.trim(), links, status: "published" });
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

  return (
    <DashboardShell title="Feed da Galera" description="Compartilhe textos, links e novidades com os membros.">
      <section className="glass rounded-xl border border-primary/20 p-4 mb-5">
        <Textarea rows={4} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escreva uma atualização, dica, link ou novidade…" />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <div className="flex flex-wrap gap-1">{links.map((l) => <Badge key={l.url} variant="outline" className="text-[10px]"><ExternalLink className="h-3 w-3 mr-1" /> {l.url.replace(/^https?:\/\//, "").slice(0, 28)}</Badge>)}</div>
          <Button onClick={publish}><Send className="h-4 w-4 mr-1" /> Publicar</Button>
        </div>
      </section>

      {isLoading ? <p className="text-muted-foreground text-sm">Carregando…</p> : (
        <div className="space-y-3">
          {posts.map((post) => <PostCard key={post.id} post={post} canRemove={isAdmin || post.author_id === user?.id} onRemove={() => remove(post)} />)}
          {posts.length === 0 && <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhum post ainda.</div>}
        </div>
      )}
    </DashboardShell>
  );
}

function extractLinks(text: string) {
  return Array.from(new Set((text.match(/https?:\/\/[^\s]+/g) ?? []).map((url) => url.replace(/[),.;!?]+$/, "")))).slice(0, 5).map((url) => ({ url }));
}

function PostCard({ post, canRemove, onRemove }: { post: FeedPost; canRemove: boolean; onRemove: () => void }) {
  const name = post.profiles?.display_name || post.profiles?.email || "Membro";
  const links = Array.isArray(post.links) ? post.links : [];
  return (
    <article className="glass rounded-xl border border-border/40 p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10"><AvatarImage src={post.profiles?.avatar_url ?? undefined} alt={name} /><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div><h2 className="text-sm font-bold">{name}</h2><p className="text-[10px] text-muted-foreground">{new Date(post.created_at).toLocaleString("pt-BR")}</p></div>
            {canRemove && <Button size="icon" variant="ghost" className="text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>}
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-3">{post.content}</p>
          {links.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />{l.url}</a>)}</div>}
        </div>
      </div>
    </article>
  );
}