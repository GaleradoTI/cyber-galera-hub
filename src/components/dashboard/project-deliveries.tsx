import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TaskLink = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  url: string;
  note: string | null;
  created_at: string;
};

export function ProjectDeliveries({
  projectId,
  profileById,
}: {
  projectId: string;
  profileById: Map<string, { display_name?: string | null; email?: string | null }>;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", note: "" });

  const { data: links = [] } = useQuery({
    queryKey: ["project-task-links", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_task_links")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaskLink[];
    },
  });

  const create = async () => {
    if (!user?.id) return;
    const title = form.title.trim();
    const url = form.url.trim();
    if (title.length < 2) return toast.error("Dê um título curto para a entrega.");
    if (!/^https?:\/\//i.test(url)) return toast.error("O link precisa começar com http(s)://");
    const { error } = await supabase.from("project_task_links").insert({
      project_id: projectId,
      user_id: user.id,
      title,
      url,
      note: form.note.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Entrega registrada.");
    setForm({ title: "", url: "", note: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["project-task-links", projectId] });
  };

  const remove = async (l: TaskLink) => {
    if (!confirm(`Remover "${l.title}"?`)) return;
    const { error } = await supabase.from("project_task_links").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["project-task-links", projectId] });
  };

  return (
    <div className="mt-5 pt-4 border-t border-border/40">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground/70 flex items-center gap-1">
          <Package className="h-3 w-3" /> ENTREGAS
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Anexar entrega
        </Button>
      </div>
      <div className="space-y-2">
        {links.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma entrega ainda.</p>
        )}
        {links.map((l) => {
          const author = profileById.get(l.user_id);
          const mine = l.user_id === user?.id;
          return (
            <div key={l.id} className="rounded-md border border-border/40 p-2 bg-muted/10 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="truncate">{l.title}</span>
                </a>
                {l.note && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{l.note}</p>}
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {author?.display_name ?? author?.email ?? "Membro"} · {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {mine && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => remove(l)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexar entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Landing page v1" />
            </div>
            <div>
              <Label>Link</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}