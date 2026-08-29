import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

export type FeedComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
};

type MiniProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

type CommentLike = { id: string; comment_id: string; user_id: string };

export function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function useCommentCount(postId: string) {
  const { data = 0 } = useQuery({
    queryKey: ["feed-comment-count", postId],
    queryFn: async () => {
      const { count } = await supabase
        .from("feed_post_comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId);
      return count ?? 0;
    },
  });
  return data;
}

export function FeedCommentsDialog({
  postId,
  open,
  onOpenChange,
  currentUserId,
  isAdmin,
  header,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string | null;
  isAdmin: boolean;
  header?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["feed-comments", postId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at");
      return ((data ?? []) as unknown) as FeedComment[];
    },
  });

  const ids = useMemo(() => comments.map((c) => c.id), [comments]);
  const { data: likes = [] } = useQuery({
    queryKey: ["feed-comment-likes", postId, ids.length],
    enabled: open && ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_comment_reactions")
        .select("id,comment_id,user_id")
        .in("comment_id", ids);
      return ((data ?? []) as unknown) as CommentLike[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(comments.map((c) => c.user_id))), [comments]);
  const { data: profiles = new Map<string, MiniProfile>() } = useQuery({
    queryKey: ["feed-comment-profiles", userIds.join(",")],
    enabled: open && userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url,email")
        .in("user_id", userIds);
      return new Map((data ?? []).map((p: any) => [p.user_id, p as MiniProfile]));
    },
  });

  const byParent = useMemo(() => {
    const map = new Map<string | null, FeedComment[]>();
    for (const c of comments) {
      const key = c.parent_id ?? null;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [comments]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["feed-comments", postId] });
    qc.invalidateQueries({ queryKey: ["feed-comment-count", postId] });
  };

  const send = async () => {
    if (!currentUserId) return toast.error("Entre para comentar.");
    const t = text.trim();
    if (!t) return;
    const { error } = await supabase.from("feed_post_comments").insert({
      post_id: postId,
      user_id: currentUserId,
      content: t,
      parent_id: replyTo?.id ?? null,
    } as any);
    if (error) return toast.error(error.message);
    setText("");
    setReplyTo(null);
    refresh();
  };

  const saveEdit = async (id: string) => {
    const t = editingText.trim();
    if (!t) return;
    const { error } = await supabase.from("feed_post_comments").update({ content: t }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("feed_post_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const toggleLike = async (commentId: string) => {
    if (!currentUserId) return toast.error("Entre para curtir.");
    const mine = likes.find((l) => l.comment_id === commentId && l.user_id === currentUserId);
    const { error } = mine
      ? await supabase.from("feed_comment_reactions").delete().eq("id", mine.id)
      : await supabase
          .from("feed_comment_reactions")
          .insert({ comment_id: commentId, user_id: currentUserId, emoji: "❤️" } as any);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["feed-comment-likes", postId] });
  };

  const renderThread = (parentId: string | null, depth: number): React.ReactNode =>
    (byParent.get(parentId) ?? []).map((c) => {
      const p = profiles instanceof Map ? profiles.get(c.user_id) : undefined;
      const name = p?.display_name || p?.email || "Membro";
      const mine = c.user_id === currentUserId;
      const likeList = likes.filter((l) => l.comment_id === c.id);
      const liked = !!currentUserId && likeList.some((l) => l.user_id === currentUserId);
      const replies = byParent.get(c.id) ?? [];

      return (
        <div
          key={c.id}
          className={cn(
            "relative",
            depth > 0 && "ml-4 sm:ml-6 pl-3 sm:pl-4 border-l border-border/40",
          )}
        >
          <div className="flex items-start gap-2 py-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={p?.avatar_url ?? undefined} alt={name} />
              <AvatarFallback className="text-[10px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold truncate">{name}</span>
                <span className="text-muted-foreground">
                  {timeAgo(c.created_at)}
                  {c.updated_at !== c.created_at ? " · editado" : ""}
                </span>
              </div>

              {editingId === c.id ? (
                <div className="mt-1 space-y-1">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={2}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => saveEdit(c.id)}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <RichText text={c.content} className="text-sm text-foreground/90 mt-0.5 break-words" />
              )}

              <div className="flex items-center gap-1 -ml-2 mt-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn("h-7 px-2 text-xs gap-1", liked && "text-primary")}
                  onClick={() => toggleLike(c.id)}
                >
                  <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
                  {likeList.length > 0 && <span className="tabular-nums">{likeList.length}</span>}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setReplyTo(c)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Responder{replies.length > 0 ? ` · ${replies.length}` : ""}
                </Button>
                {mine && editingId !== c.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    aria-label="Editar comentário"
                    onClick={() => { setEditingId(c.id); setEditingText(c.content); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {(mine || isAdmin) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive"
                    aria-label="Excluir comentário"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {renderThread(c.id, depth + 1)}
        </div>
      );
    });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setReplyTo(null); }}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border/40">
          <DialogTitle className="text-base">Comentários</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {header && <div className="py-3 border-b border-border/30">{header}</div>}
          {isLoading && <p className="py-6 text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum comentário ainda. Seja o primeiro a responder.
            </p>
          )}
          <div className="py-1">{renderThread(null, 0)}</div>
        </div>

        <div className="border-t border-border/40 p-3 space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                Respondendo a{" "}
                <strong className="text-foreground">
                  {(profiles instanceof Map ? profiles.get(replyTo.user_id)?.display_name : null) || "comentário"}
                </strong>
              </span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setReplyTo(null)}>
                Cancelar
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              placeholder={replyTo ? "Escreva sua resposta…" : "Comente algo…"}
              className="min-h-[38px] max-h-32 text-sm resize-none"
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={send} disabled={!text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
