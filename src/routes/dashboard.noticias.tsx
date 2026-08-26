import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Eye, EyeOff, Pencil, Plus, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichText, extractLinks, mergeLinks, parseLinkLines, linksToLines } from "@/lib/rich-text";

export const Route = createFileRoute("/dashboard/noticias")({ component: NoticiasPage });

type News = {
  id: string;
  author_id: string;
  title: string | null;
  content: string;
  cover_url: string | null;
  pinned_until: string | null;
  created_at: string;
  updated_at: string;
  kind: string;
  status: string;
  links: { url: string; label?: string }[] | null;
};

function NoticiasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<News> | null>(null);
  const [linkLines, setLinkLines] = useState("");
  const [viewing, setViewing] = useState<News | null>(null);

  const openEditor = (n?: News) => {
    setLinkLines(linksToLines(n?.links));
    setEditing(
      n ?? { title: "", content: "", cover_url: "", pinned_until: "", status: "published", links: [] },
    );
  };

  useEffect(() => {
    if (rolesReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [rolesReady, isAdmin, navigate]);

  const { data: news = [], isLoading } = useQuery({
    queryKey: ["news-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_feed_posts")
        .select("*")
        .eq("kind", "news")
        .neq("status", "deleted")
        .order("pinned_until", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as News[];
    },
  });

  const save = async () => {
    if (!editing || !user?.id) return;
    const title = (editing.title ?? "").trim();
    const content = (editing.content ?? "").trim();
    if (title.length < 2) return toast.error("Título obrigatório.");
    if (content.length < 2) return toast.error("Conteúdo obrigatório.");
    const links = mergeLinks(parseLinkLines(linkLines), extractLinks(content));
    const payload = {
      title,
      content,
      cover_url: editing.cover_url?.trim() || null,
      pinned_until: editing.pinned_until || null,
      links,
      status: editing.status === "draft" ? "draft" : "published",
    };
    const { error } = editing.id
      ? await supabase.from("member_feed_posts").update(payload).eq("id", editing.id)
      : await supabase
          .from("member_feed_posts")
          .insert({ ...payload, author_id: user.id, kind: "news" });
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Notícia atualizada." : "Notícia publicada.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["news-admin"] });
    qc.invalidateQueries({ queryKey: ["member-feed"] });
  };

  const remove = async (n: News) => {
    if (!confirm(`Remover notícia "${n.title}"?`)) return;
    const { error } = await supabase.from("member_feed_posts").delete().eq("id", n.id);
    if (error) return toast.error(error.message);
    toast.success("Removida.");
    qc.invalidateQueries({ queryKey: ["news-admin"] });
    qc.invalidateQueries({ queryKey: ["member-feed"] });
  };

  return (
    <DashboardShell title="Notícias da Comunidade" description="Publique novidades oficiais que aparecem em destaque no feed.">
      <div className="flex justify-end mb-3">
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4 mr-1" /> Nova notícia
        </Button>
      </div>

      <div className="glass rounded-xl border border-primary/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">No feed</TableHead>
              <TableHead className="hidden md:table-cell">Publicado</TableHead>
              <TableHead className="hidden md:table-cell">Destaque até</TableHead>
              <TableHead className="w-[160px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando…</TableCell>
              </TableRow>
            )}
            {!isLoading && news.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma notícia ainda.</TableCell>
              </TableRow>
            )}
            {news.map((n) => {
              const pinned = n.pinned_until && new Date(n.pinned_until) > new Date();
              return (
                <TableRow key={n.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {pinned && <Badge className="bg-secondary/20 text-secondary border-secondary/40"><Pin className="h-3 w-3 mr-1" />Fixada</Badge>}
                      <span className="font-semibold">{n.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.content}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {n.pinned_until ? new Date(n.pinned_until).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(n)}><Eye className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(n)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(n)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar notícia" : "Nova notícia"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={160} />
              </div>
              <div>
                <Label>Conteúdo *</Label>
                <Textarea rows={6} value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} maxLength={2000} />
              </div>
              <div>
                <Label>URL da capa (opcional)</Label>
                <Input value={editing.cover_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} placeholder="https://…" />
              </div>
              <div>
                <Label>Fixar no topo até (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={editing.pinned_until ? editing.pinned_until.slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, pinned_until: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>{editing?.id ? "Salvar" : "Publicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              {viewing.cover_url && (
                <img src={viewing.cover_url} alt={viewing.title ?? ""} className="rounded-lg w-full max-h-64 object-cover" />
              )}
              <p className="text-xs text-muted-foreground">
                Publicada em {new Date(viewing.created_at).toLocaleString("pt-BR")}
                {viewing.pinned_until && ` · Fixada até ${new Date(viewing.pinned_until).toLocaleString("pt-BR")}`}
              </p>
              <p className="text-sm whitespace-pre-wrap">{viewing.content}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}