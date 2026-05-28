import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Profile = { user_id: string; display_name: string; avatar_url: string | null };
type Comment = { id: string; post_id: string; user_id: string; content: string; created_at: string };
type Reaction = { id: string; post_id: string; user_id: string; emoji: string };

const EMOJIS = ["👍", "❤️", "🚀", "🎉"];

export function PostCard({
  post,
  author,
  currentUserId,
  profileById,
  onDelete,
}: {
  post: { id: string; content: string; created_at: string; user_id: string };
  author?: { display_name?: string };
  currentUserId: string;
  profileById: Map<string, Profile>;
  onDelete?: () => void;
}) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const { data: reactions = [] } = useQuery({
    queryKey: ["post-reactions", post.id],
    queryFn: async () => {
      const { data } = await supabase.from("post_reactions").select("*").eq("post_id", post.id);
      return (data ?? []) as Reaction[];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", post.id],
    enabled: showComments,
    queryFn: async () => {
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", post.id).order("created_at");
      return (data ?? []) as Comment[];
    },
  });

  const toggleReaction = async (emoji: string) => {
    const mine = reactions.find((r) => r.user_id === currentUserId && r.emoji === emoji);
    if (mine) {
      await supabase.from("post_reactions").delete().eq("id", mine.id);
    } else {
      const { error } = await supabase.from("post_reactions").insert({ post_id: post.id, user_id: currentUserId, emoji });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["post-reactions", post.id] });
  };

  const sendComment = async () => {
    const t = commentText.trim();
    if (!t) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: post.id, user_id: currentUserId, content: t });
    if (error) return toast.error(error.message);
    setCommentText("");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
  };

  const deleteComment = async (id: string) => {
    await supabase.from("post_comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
  };

  const counts: Record<string, { count: number; mine: boolean }> = {};
  EMOJIS.forEach((e) => {
    const list = reactions.filter((r) => r.emoji === e);
    counts[e] = { count: list.length, mine: list.some((r) => r.user_id === currentUserId) };
  });

  const mine = post.user_id === currentUserId;

  return (
    <div className="rounded-md border border-border/30 p-3 bg-muted/10">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{author?.display_name ?? "Usuário"}</span>
          {" • "}
          {new Date(post.created_at).toLocaleString("pt-BR")}
        </div>
        {mine && onDelete && (
          <Button size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className="text-sm mt-1 whitespace-pre-wrap">{post.content}</p>

      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => toggleReaction(e)}
            className={`text-xs px-2 py-0.5 rounded-full border transition ${
              counts[e].mine ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:bg-muted/40"
            }`}
          >
            {e} {counts[e].count > 0 && <span className="ml-0.5">{counts[e].count}</span>}
          </button>
        ))}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="text-xs px-2 py-0.5 rounded-full border border-border/40 hover:bg-muted/40 inline-flex items-center gap-1 ml-1"
        >
          <MessageCircle className="h-3 w-3" /> {showComments ? "Ocultar" : "Comentar"}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
          {comments.map((c) => {
            const u = profileById.get(c.user_id);
            const isMine = c.user_id === currentUserId;
            return (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                <div className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center font-black text-[10px]">
                  {(u?.display_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 bg-background/50 rounded px-2 py-1">
                  <div className="font-semibold">{u?.display_name ?? "Usuário"}</div>
                  <div className="text-muted-foreground whitespace-pre-wrap">{c.content}</div>
                </div>
                {isMine && (
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => deleteComment(c.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
          <div className="flex gap-1">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendComment()}
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