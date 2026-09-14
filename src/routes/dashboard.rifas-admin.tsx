import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Gift, Ticket, Trophy, Check, X, Download, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploader } from "@/components/ui/image-uploader";
import { downloadCSV } from "@/lib/csv";
import { centsToMoneyInput, moneyInputToCents } from "@/lib/formatters";
import { RAFFLE_STATUS, TICKET_STATUS, type Raffle, type RafflePrize, type RaffleTicket } from "@/lib/raffles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/rifas-admin")({
  head: () => ({ meta: [{ title: "Gerenciar rifas — GALERA DO T.I." }, { name: "robots", content: "noindex" }] }),
  component: RafflesAdminPage,
});

function RafflesAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, rolesReady } = useDashboardRoles();
  const [editing, setEditing] = useState<Partial<Raffle> | null>(null);
  const [prizesOf, setPrizesOf] = useState<Raffle | null>(null);
  const [ticketsOf, setTicketsOf] = useState<Raffle | null>(null);
  const [deleteOf, setDeleteOf] = useState<Raffle | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (rolesReady && !isAdmin) navigate({ to: "/dashboard" }); }, [rolesReady, isAdmin, navigate]);

  const { data: raffles = [], isLoading } = useQuery({
    queryKey: ["admin-raffles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("raffles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Raffle[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-raffles"] });
    qc.invalidateQueries({ queryKey: ["raffles-public"] });
  };

  const startNew = () =>
    setEditing({
      title: "", reason: "", description: "", ticket_price_cents: 0, pix_key: "",
      total_numbers: 100, entry_mode: "number", max_per_user: null, status: "draft",
      draw_date: null, cover_url: null, payment_methods: ["Pix"],
    });

  const save = async () => {
    if (!editing) return;
    const errs: Record<string, string> = {};
    if (!editing.title?.trim() || editing.title.trim().length < 3) errs.title = "Informe um título com ao menos 3 caracteres";
    if ((editing.ticket_price_cents ?? 0) <= 0) errs.price = "Informe o valor do número";
    if (editing.entry_mode !== "name" && ((editing.total_numbers ?? 0) < 1 || (editing.total_numbers ?? 0) > 10000))
      errs.total = "Entre 1 e 10.000 números";
    if (!editing.pix_key?.trim()) errs.pix = "Informe a chave Pix para receber os pagamentos";
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Corrija os campos destacados");

    const payload = {
      title: editing.title!.trim(),
      reason: editing.reason?.trim() || null,
      description: editing.description?.trim() || null,
      ticket_price_cents: Number(editing.ticket_price_cents) || 0,
      pix_key: editing.pix_key!.trim(),
      payment_methods: editing.payment_methods ?? ["Pix"],
      total_numbers: Number(editing.total_numbers) || 100,
      entry_mode: editing.entry_mode || "number",
      max_per_user: editing.max_per_user ? Number(editing.max_per_user) : null,
      draw_date: editing.draw_date || null,
      cover_url: editing.cover_url || null,
      status: editing.status || "draft",
      created_by: user?.id ?? null,
    };
    const { error } = editing.id
      ? await supabase.from("raffles").update(payload as any).eq("id", editing.id)
      : await supabase.from("raffles").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Rifa atualizada" : "Rifa criada");
    setEditing(null);
    setErrors({});
    invalidate();
  };

  const confirmRemove = async () => {
    if (!deleteOf) return;
    const { error } = await supabase.from("raffles").delete().eq("id", deleteOf.id);
    if (error) return toast.error(error.message);
    toast.success("Rifa excluída");
    setDeleteOf(null);
    invalidate();
  };

  const draw = async (r: Raffle) => {
    const { data, error } = await supabase.rpc("draw_raffle", { _raffle_id: r.id });
    if (error) return toast.error(error.message);
    const results = (data ?? []) as any[];
    if (!results.length) return toast.error("Nenhum número pago disponível para sortear.");
    toast.success(
      results.map((x) => `${x.prize_title}: ${x.winner}${x.number != null ? ` (nº ${x.number})` : ""}`).join(" · "),
      { duration: 12000 },
    );
    invalidate();
    qc.invalidateQueries({ queryKey: ["raffle-prizes"] });
    qc.invalidateQueries({ queryKey: ["raffle-tickets"] });
  };

  return (
    <DashboardShell title="Rifas" description="Crie rifas, valide os pagamentos e faça o sorteio. Tudo cai no Financeiro.">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{raffles.length} rifa(s)</p>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Nova rifa</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {raffles.map((r) => {
          const meta = RAFFLE_STATUS[r.status] ?? RAFFLE_STATUS.draft;
          return (
            <div key={r.id} className="glass rounded-xl overflow-hidden border border-primary/20">
              {r.cover_url ? (
                <img src={r.cover_url} alt={r.title} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-primary/10 flex items-center justify-center"><Gift className="h-8 w-8 text-primary/40" /></div>
              )}
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{r.title}</h3>
                    <div className="text-xs text-primary font-bold">{centsToMoneyInput(r.ticket_price_cents)}</div>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", meta.className)}>{meta.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" title="Números" onClick={() => setTicketsOf(r)}><Ticket className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" title="Prêmios" onClick={() => setPrizesOf(r)}><Gift className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing({ ...r })}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" title="Sortear" onClick={() => draw(r)}><Trophy className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive ml-auto" title="Excluir" onClick={() => setDeleteOf(r)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar rifa" : "Nova rifa"}</DialogTitle>
            <DialogDescription>Defina o motivo, o valor, a chave Pix e quantos números estarão disponíveis.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input maxLength={120} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>
              <div>
                <Label>Motivo da rifa</Label>
                <Input maxLength={160} placeholder="Ex: arrecadar para o evento de fim de ano" value={editing.reason ?? ""} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={4} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Valor por número</Label>
                  <Input inputMode="numeric" value={centsToMoneyInput(editing.ticket_price_cents ?? 0)} onChange={(e) => setEditing({ ...editing, ticket_price_cents: moneyInputToCents(e.target.value) })} />
                  {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
                </div>
                <div>
                  <Label>Chave Pix</Label>
                  <Input placeholder="CPF, email, telefone ou chave aleatória" value={editing.pix_key ?? ""} onChange={(e) => setEditing({ ...editing, pix_key: e.target.value })} />
                  {errors.pix && <p className="text-xs text-destructive mt-1">{errors.pix}</p>}
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>Tipo de entrada</Label>
                  <Select value={editing.entry_mode ?? "number"} onValueChange={(v) => setEditing({ ...editing, entry_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Números</SelectItem>
                      <SelectItem value="name">Nomes livres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade de números</Label>
                  <Input type="number" min={1} max={10000} value={editing.total_numbers ?? 100} onChange={(e) => setEditing({ ...editing, total_numbers: Number(e.target.value) })} />
                  {errors.total && <p className="text-xs text-destructive mt-1">{errors.total}</p>}
                </div>
                <div>
                  <Label>Limite por pessoa</Label>
                  <Input type="number" min={1} placeholder="sem limite" value={editing.max_per_user ?? ""} onChange={(e) => setEditing({ ...editing, max_per_user: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Data do sorteio</Label>
                  <Input
                    type="datetime-local"
                    value={editing.draw_date ? String(editing.draw_date).slice(0, 16) : ""}
                    onChange={(e) => setEditing({ ...editing, draw_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
                <div>
                  <Label>Situação</Label>
                  <Select value={editing.status ?? "draft"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho (invisível)</SelectItem>
                      <SelectItem value="open">Aberta para reservas</SelectItem>
                      <SelectItem value="closed">Encerrada</SelectItem>
                      <SelectItem value="drawn">Sorteada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Imagem de capa</Label>
                <ImageUploader
                  bucket="project-covers"
                  folder={`raffles/${user?.id ?? "shared"}`}
                  value={editing.cover_url ?? null}
                  onChange={(url) => setEditing({ ...editing, cover_url: url })}
                  label="Enviar capa"
                  aspect="video"
                  maxBytes={8 * 1024 * 1024}
                  policyKey="drop_images"
                  auditEntity="drop_image"
                  auditEntityId={editing.id ?? null}
                  showDiagnostics
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrizesDialog raffle={prizesOf} userId={user?.id ?? null} onClose={() => setPrizesOf(null)} />
      <TicketsDialog raffle={ticketsOf} adminId={user?.id ?? null} onClose={() => setTicketsOf(null)} />

      <AlertDialog open={!!deleteOf} onOpenChange={(o) => !o && setDeleteOf(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteOf?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os números reservados e prêmios da rifa serão apagados. Prefira marcar como <em>Encerrada</em> para manter o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

/* ---------------------- Prêmios ---------------------- */
function PrizesDialog({ raffle, userId, onClose }: { raffle: Raffle | null; userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<RafflePrize> | null>(null);

  const { data: prizes = [] } = useQuery({
    queryKey: ["raffle-prizes", raffle?.id],
    enabled: !!raffle?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("raffle_prizes").select("*").eq("raffle_id", raffle!.id).order("display_order");
      if (error) throw error;
      return (data ?? []) as RafflePrize[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["raffle-prizes", raffle?.id] });

  const save = async () => {
    if (!draft || !raffle) return;
    if (!draft.title?.trim()) return toast.error("Informe o nome do prêmio");
    const payload = {
      raffle_id: raffle.id,
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      image_url: draft.image_url || null,
      display_order: Number(draft.display_order ?? prizes.length),
    };
    const { error } = draft.id
      ? await supabase.from("raffle_prizes").update(payload as any).eq("id", draft.id)
      : await supabase.from("raffle_prizes").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Prêmio salvo");
    setDraft(null);
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("raffle_prizes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Prêmio removido");
    refresh();
  };

  return (
    <Dialog open={!!raffle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prêmios — {raffle?.title}</DialogTitle>
          <DialogDescription>Cadastre quantos prêmios quiser. A ordem define 1º, 2º, 3º lugar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {prizes.map((p, i) => (
            <div key={p.id} className="rounded-lg border border-border/40 bg-muted/10 p-3 flex items-center gap-3">
              {p.image_url ? (
                <img src={p.image_url} alt={p.title} className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center"><Gift className="h-4 w-4 text-primary/50" /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{i + 1}º · {p.title}</div>
                {p.description && <p className="text-[11px] text-muted-foreground truncate">{p.description}</p>}
                {p.winner_ticket_id && <Badge className="mt-1 bg-gradient-neon text-background text-[10px]"><Trophy className="h-3 w-3 mr-1" /> Sorteado</Badge>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDraft({ ...p })}><Pencil className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {prizes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum prêmio cadastrado ainda.</p>}
        </div>

        {draft ? (
          <div className="space-y-3 rounded-lg border border-primary/30 p-3">
            <div>
              <Label>Prêmio</Label>
              <Input maxLength={120} value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" min={0} value={draft.display_order ?? prizes.length} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })} />
            </div>
            <ImageUploader
              bucket="project-covers"
              folder={`raffles/${userId ?? "shared"}`}
              value={draft.image_url ?? null}
              onChange={(url) => setDraft({ ...draft, image_url: url })}
              label="Imagem do prêmio"
              aspect="square"
              maxBytes={8 * 1024 * 1024}
              policyKey="drop_images"
              auditEntity="drop_image"
              auditEntityId={draft.id ?? null}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancelar</Button>
              <Button size="sm" onClick={save}>Salvar prêmio</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setDraft({ title: "", description: "", display_order: prizes.length })}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar prêmio
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------- Números / validação ---------------------- */
function TicketsDialog({ raffle, adminId, onClose }: { raffle: Raffle | null; adminId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: tickets = [] } = useQuery({
    queryKey: ["raffle-tickets", raffle?.id],
    enabled: !!raffle?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("raffle_tickets").select("*").eq("raffle_id", raffle!.id).order("number", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as RaffleTicket[];
    },
  });

  const rows = tickets.filter((t) => filter === "all" || t.status === filter);
  const paid = tickets.filter((t) => t.status === "paid");
  const total = paid.reduce((a, t) => a + (t.amount_cents ?? 0), 0);

  const setStatus = async (t: RaffleTicket, status: string) => {
    const { error } = await supabase
      .from("raffle_tickets")
      .update({ status, confirmed_by: status === "paid" ? adminId : null, confirmed_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(status === "paid" ? "Pagamento validado e lançado no Financeiro" : "Reserva cancelada");
    qc.invalidateQueries({ queryKey: ["raffle-tickets", raffle?.id] });
    qc.invalidateQueries({ queryKey: ["finance-entries"] });
  };

  const exportCsv = () =>
    downloadCSV(`rifa-${raffle?.title ?? "numeros"}-${new Date().toISOString().slice(0, 10)}.csv`,
      tickets.map((t) => ({
        numero: t.number ?? "",
        nome_na_rifa: t.label ?? "",
        comprador: t.buyer_name,
        email: t.buyer_email ?? "",
        telefone: t.buyer_phone ?? "",
        valor: centsToMoneyInput(t.amount_cents),
        status: TICKET_STATUS[t.status]?.label ?? t.status,
        ganhador: t.is_winner ? "sim" : "não",
        data: new Date(t.created_at).toLocaleString("pt-BR"),
      })));

  return (
    <Dialog open={!!raffle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Números — {raffle?.title}</DialogTitle>
          <DialogDescription>
            {tickets.length} reserva(s) · {paid.length} paga(s) · arrecadado {centsToMoneyInput(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {["all", "reserved", "paid", "cancelled"].map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {k === "all" ? "Todos" : TICKET_STATUS[k]?.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </div>

        <div className="space-y-2">
          {rows.map((t) => {
            const meta = TICKET_STATUS[t.status] ?? TICKET_STATUS.reserved;
            return (
              <div key={t.id} className="rounded-lg border border-border/40 bg-muted/10 p-3 flex flex-wrap items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/15 text-primary font-black flex items-center justify-center text-sm shrink-0">
                  {t.number ?? "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{t.buyer_name}{t.label ? ` · ${t.label}` : ""}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {t.buyer_email ?? "—"} · {centsToMoneyInput(t.amount_cents)} · {new Date(t.created_at).toLocaleString("pt-BR")}
                  </div>
                  {t.note && <p className="text-[11px] italic text-muted-foreground">"{t.note}"</p>}
                </div>
                {t.is_winner && <Badge className="bg-gradient-neon text-background text-[10px]"><Trophy className="h-3 w-3 mr-1" /> Ganhador</Badge>}
                <Badge variant="outline" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
                {t.receipt_url ? (
                  <a href={t.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Comprovante
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">sem comprovante</span>
                )}
                {t.status !== "paid" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(t, "paid")}><Check className="h-3 w-3 mr-1" /> Validar</Button>
                )}
                {t.status !== "cancelled" && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(t, "cancelled")}><X className="h-3 w-3" /></Button>
                )}
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 flex items-center justify-center gap-2">
              <Sparkles className="h-3 w-3" /> Nenhuma reserva neste filtro.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
