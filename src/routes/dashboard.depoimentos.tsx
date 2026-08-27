import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Plus, Pencil, Trash2, Check, X, MessageSquareQuote, Clock, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/depoimentos")({ component: DepoimentosPage });

type Testimonial = {
  id: string;
  user_id: string;
  rating: number;
  content: string;
  role_title: string | null;
  company: string | null;
  status: "pending" | "approved" | "rejected";
  moderator_note: string | null;
  moderated_at: string | null;
  created_at: string;
};

type ProfileLite = { user_id: string; display_name: string; avatar_url: string | null; email: string };

function StatusBadge({ status }: { status: Testimonial["status"] }) {
  const map = {
    pending: { label: "Pendente", icon: Clock, cls: "border-amber-500/60 text-amber-400" },
    approved: { label: "Aprovado", icon: CheckCircle2, cls: "border-emerald-500/60 text-emerald-400" },
    rejected: { label: "Rejeitado", icon: XCircle, cls: "border-destructive/60 text-destructive" },
  } as const;
  const m = map[status];
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", m.cls)}>
      <Icon className="h-3 w-3" /> {m.label}
    </Badge>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn("transition", onChange && "hover:scale-110 cursor-pointer", !onChange && "cursor-default")}
          aria-label={`${n} estrelas`}
        >
          <Star className={cn("h-5 w-5", n <= value ? "fill-secondary text-secondary" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function DepoimentosPage() {
  const { user, isAdmin } = useDashboardRoles();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null);
  const [moderating, setModerating] = useState<Testimonial | null>(null);
  const [modNote, setModNote] = useState("");

  const { data: mine = [], isLoading: loadingMine } = useQuery({
    queryKey: ["my-testimonials", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Testimonial[];
    },
  });

  const { data: queue = [], isLoading: loadingQueue } = useQuery({
    queryKey: ["testimonials-queue"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Testimonial[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set([...mine.map((t) => t.user_id), ...queue.map((t) => t.user_id)])),
    [mine, queue],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["testimonials-authors", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("user_id,display_name,avatar_url,email").in("user_id", userIds);
      if (error) throw error;
      return (data ?? []) as ProfileLite[];
    },
  });
  const profById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);

  const save = async () => {
    if (!editing) return;
    if (!editing.content || editing.content.trim().length < 10) return toast.error("Conte um pouco mais (mín. 10 caracteres).");
    if (!editing.rating || editing.rating < 1) return toast.error("Selecione uma nota de 1 a 5.");
    const payload = {
      content: editing.content.trim(),
      rating: editing.rating,
      role_title: editing.role_title?.trim() || null,
    };
    const { error } = editing.id
      ? await supabase.from("testimonials").update(payload).eq("id", editing.id)
      : await supabase.from("testimonials").insert({ ...payload, user_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Depoimento atualizado." : "Depoimento enviado para moderação.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["my-testimonials"] });
    qc.invalidateQueries({ queryKey: ["testimonials-queue"] });
    qc.invalidateQueries({ queryKey: ["public-testimonials"] });
  };

  const remove = async (t: Testimonial) => {
    if (!confirm("Excluir este depoimento?")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Depoimento removido.");
    qc.invalidateQueries({ queryKey: ["my-testimonials"] });
    qc.invalidateQueries({ queryKey: ["testimonials-queue"] });
    qc.invalidateQueries({ queryKey: ["public-testimonials"] });
  };

  const moderate = async (status: "approved" | "rejected") => {
    if (!moderating) return;
    const { error } = await supabase
      .from("testimonials")
      .update({ status, moderator_note: modNote.trim() || null })
      .eq("id", moderating.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Depoimento aprovado." : "Depoimento rejeitado.");
    setModerating(null);
    setModNote("");
    qc.invalidateQueries({ queryKey: ["testimonials-queue"] });
    qc.invalidateQueries({ queryKey: ["public-testimonials"] });
  };

  return (
    <DashboardShell title="Depoimentos" description="Compartilhe sua experiência com a comunidade. Depois de aprovado, ele aparece na página inicial.">
      <Tabs defaultValue="meus" className="w-full">
        <TabsList className="bg-muted/40 p-1">
          <TabsTrigger value="meus">
            <MessageSquareQuote className="h-3.5 w-3.5 mr-1.5" /> Meus depoimentos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="moderar">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Moderar
              <Badge variant="outline" className="ml-2 text-[10px]">
                {queue.filter((t) => t.status === "pending").length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="meus" className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{mine.length} depoimento(s)</p>
            <Button onClick={() => setEditing({ rating: 5, content: "", role_title: "" })}>
              <Plus className="h-4 w-4 mr-1" /> Novo depoimento
            </Button>
          </div>
          {loadingMine && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loadingMine && mine.length === 0 && (
            <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
              Você ainda não escreveu nenhum depoimento.
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {mine.map((t) => (
              <div key={t.id} className="glass rounded-xl p-4 border border-primary/20">
                <div className="flex items-start justify-between gap-2">
                  <Stars value={t.rating} />
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{t.content}</p>
                {t.role_title && <p className="text-xs text-muted-foreground mt-2">— {t.role_title}</p>}
                {t.status === "rejected" && t.moderator_note && (
                  <p className="text-xs text-destructive mt-2">Nota do moderador: {t.moderator_note}</p>
                )}
                <div className="flex gap-1 mt-3">
                  {t.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(t)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="moderar" className="mt-5 space-y-3">
            {loadingQueue && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!loadingQueue && queue.length === 0 && (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
                Nenhum depoimento ainda.
              </div>
            )}
            {queue.map((t) => {
              const a = profById.get(t.user_id);
              return (
                <div key={t.id} className="glass rounded-xl p-4 border border-primary/20">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {a?.avatar_url ? (
                        <img src={a.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-xs font-black">
                          {(a?.display_name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold">{a?.display_name ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{a?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Stars value={t.rating} />
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  <p className="text-sm mt-3 whitespace-pre-wrap">{t.content}</p>
                  {t.role_title && <p className="text-xs text-muted-foreground mt-1">— {t.role_title}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Enviado em {new Date(t.created_at).toLocaleString("pt-BR")}
                  </p>
                  {t.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => { setModerating(t); setModNote(""); }}>
                        Moderar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        )}
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar depoimento" : "Novo depoimento"}</DialogTitle>
            <DialogDescription>Depois de enviado, passa por aprovação antes de aparecer publicamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Sua nota</Label>
              <div className="mt-1"><Stars value={editing?.rating ?? 5} onChange={(n) => setEditing({ ...editing!, rating: n })} /></div>
            </div>
            <div>
              <Label>Cargo / atuação (opcional)</Label>
              <Input placeholder="Ex.: Dev Front-end @ Empresa" value={editing?.role_title ?? ""} onChange={(e) => setEditing({ ...editing!, role_title: e.target.value })} />
            </div>
            <div>
              <Label>Seu depoimento</Label>
              <Textarea
                rows={5}
                maxLength={1000}
                placeholder="Conte como a comunidade te ajudou…"
                value={editing?.content ?? ""}
                onChange={(e) => setEditing({ ...editing!, content: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{(editing?.content ?? "").length}/1000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Moderate dialog */}
      <Dialog open={!!moderating} onOpenChange={(o) => !o && setModerating(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Moderar depoimento</DialogTitle>
            <DialogDescription>Aprove para publicar ou rejeite com uma observação opcional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border/40 bg-muted/20 p-3 text-sm">
              <Stars value={moderating?.rating ?? 0} />
              <p className="mt-2 whitespace-pre-wrap">{moderating?.content}</p>
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea rows={3} value={modNote} onChange={(e) => setModNote(e.target.value)} placeholder="Visível ao autor em caso de rejeição." />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setModerating(null)}>Cancelar</Button>
            <Button variant="outline" className="text-destructive" onClick={() => moderate("rejected")}>
              <X className="h-4 w-4 mr-1" /> Rejeitar
            </Button>
            <Button onClick={() => moderate("approved")}>
              <Check className="h-4 w-4 mr-1" /> Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}