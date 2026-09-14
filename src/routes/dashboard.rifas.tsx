import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Gift, Copy, Trophy, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, useDashboardRoles } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/ui/image-uploader";
import { centsToMoneyInput } from "@/lib/formatters";
import { useSiteModules } from "@/lib/modules";
import { RAFFLE_STATUS, TICKET_STATUS, type Raffle, type RafflePrize, type RaffleTicket } from "@/lib/raffles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/rifas")({
  head: () => ({ meta: [{ title: "Rifas — GALERA DO T.I." }, { name: "robots", content: "noindex" }] }),
  component: RafflesMemberPage,
});

function RafflesMemberPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useDashboardRoles();
  const { rafflesEnabled, loading: modulesLoading } = useSiteModules();
  const [openRaffle, setOpenRaffle] = useState<Raffle | null>(null);

  useEffect(() => {
    if (!modulesLoading && !rafflesEnabled) navigate({ to: "/dashboard" });
  }, [modulesLoading, rafflesEnabled, navigate]);

  const { data: raffles = [], isLoading } = useQuery({
    queryKey: ["raffles-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffles")
        .select("*")
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Raffle[];
    },
  });

  const { data: myTickets = [] } = useQuery({
    queryKey: ["raffle-my-tickets", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffle_tickets")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RaffleTicket[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["raffle-my-tickets"] });
    qc.invalidateQueries({ queryKey: ["raffle-tickets"] });
  };

  const raffleName = (id: string) => raffles.find((r) => r.id === id)?.title ?? "Rifa";

  return (
    <DashboardShell title="Rifas" description="Escolha seus números, reserve e envie o comprovante do Pix.">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && raffles.length === 0 && (
        <div className="glass rounded-xl border border-primary/20 p-10 text-center">
          <Ticket className="h-8 w-8 mx-auto text-primary/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma rifa disponível no momento.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {raffles.map((r) => {
          const meta = RAFFLE_STATUS[r.status] ?? RAFFLE_STATUS.draft;
          return (
            <div key={r.id} className="glass rounded-xl overflow-hidden border border-primary/20 flex flex-col">
              {r.cover_url ? (
                <img src={r.cover_url} alt={r.title} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-primary/10 flex items-center justify-center"><Gift className="h-9 w-9 text-primary/40" /></div>
              )}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-tight">{r.title}</h3>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", meta.className)}>{meta.label}</Badge>
                </div>
                {r.reason && <p className="text-xs text-muted-foreground line-clamp-2">{r.reason}</p>}
                <div className="text-sm font-bold text-primary">{centsToMoneyInput(r.ticket_price_cents)} <span className="text-xs font-normal text-muted-foreground">por número</span></div>
                {r.draw_date && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Sorteio em {new Date(r.draw_date).toLocaleString("pt-BR")}
                  </p>
                )}
                <Button size="sm" className="mt-auto" onClick={() => setOpenRaffle(r)}>
                  {r.status === "open" ? "Participar" : "Ver detalhes"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {myTickets.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold tracking-[0.2em] text-muted-foreground mb-3">MEUS NÚMEROS</h2>
          <div className="space-y-2">
            {myTickets.map((t) => {
              const meta = TICKET_STATUS[t.status] ?? TICKET_STATUS.reserved;
              return (
                <div key={t.id} className="glass rounded-lg border border-border/40 p-3 flex flex-wrap items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/15 text-primary font-black flex items-center justify-center text-sm shrink-0">
                    {t.number ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{raffleName(t.raffle_id)}{t.label ? ` · ${t.label}` : ""}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {centsToMoneyInput(t.amount_cents)} · {new Date(t.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  {t.is_winner && <Badge className="bg-gradient-neon text-background"><Trophy className="h-3 w-3 mr-1" /> Ganhador</Badge>}
                  <Badge variant="outline" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
                  {t.status === "reserved" && (
                    <div className="w-full sm:w-auto">
                      <ImageUploader
                        bucket="project-covers"
                        folder={`raffles/${user?.id ?? "shared"}`}
                        value={t.receipt_url}
                        label={t.receipt_url ? "Trocar comprovante" : "Enviar comprovante"}
                        aspect="square"
                        maxBytes={8 * 1024 * 1024}
                        policyKey="drop_images"
                        auditEntity="raffle_receipt"
                        auditEntityId={t.id}
                        onChange={async (url) => {
                          const { error } = await supabase.from("raffle_tickets").update({ receipt_url: url }).eq("id", t.id);
                          if (error) return toast.error(error.message);
                          toast.success("Comprovante enviado. Aguarde a validação.");
                          refresh();
                        }}
                      />
                    </div>
                  )}
                  {t.status === "reserved" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        const { error } = await supabase.from("raffle_tickets").delete().eq("id", t.id);
                        if (error) return toast.error(error.message);
                        toast.success("Reserva cancelada");
                        refresh();
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RaffleDialog
        raffle={openRaffle}
        onClose={() => setOpenRaffle(null)}
        userId={user?.id ?? null}
        buyerName={profile?.display_name ?? ""}
        buyerEmail={profile?.email ?? ""}
        buyerPhone={(profile as any)?.phone ?? ""}
        onReserved={refresh}
      />
    </DashboardShell>
  );
}

function RaffleDialog({
  raffle, onClose, userId, buyerName, buyerEmail, buyerPhone, onReserved,
}: {
  raffle: Raffle | null;
  onClose: () => void;
  userId: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  onReserved: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelected([]); setLabel(""); setNote(""); }, [raffle?.id]);

  const { data: prizes = [] } = useQuery({
    queryKey: ["raffle-prizes", raffle?.id],
    enabled: !!raffle?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("raffle_prizes").select("*").eq("raffle_id", raffle!.id).order("display_order");
      if (error) throw error;
      return (data ?? []) as RafflePrize[];
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["raffle-tickets", raffle?.id],
    enabled: !!raffle?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("raffle_tickets").select("*").eq("raffle_id", raffle!.id);
      if (error) throw error;
      return (data ?? []) as RaffleTicket[];
    },
  });

  const taken = useMemo(() => {
    const map = new Map<number, RaffleTicket>();
    tickets.filter((t) => t.status !== "cancelled" && t.number != null).forEach((t) => map.set(t.number!, t));
    return map;
  }, [tickets]);

  const mine = tickets.filter((t) => t.user_id === userId && t.status !== "cancelled").length;
  const limit = raffle?.max_per_user ?? null;
  const isOpen = raffle?.status === "open";
  const total = (raffle?.ticket_price_cents ?? 0) * Math.max(selected.length, raffle?.entry_mode === "name" ? 1 : 0);

  const toggle = (n: number) => {
    if (taken.has(n)) return;
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  };

  const reserve = async () => {
    if (!raffle || !userId) return;
    const useNumbers = raffle.entry_mode !== "name";
    if (useNumbers && selected.length === 0) return toast.error("Escolha ao menos um número.");
    if (!useNumbers && !label.trim()) return toast.error("Informe o nome que entra na rifa.");
    if (limit && mine + (useNumbers ? selected.length : 1) > limit) {
      return toast.error(`Limite de ${limit} número(s) por pessoa nesta rifa.`);
    }
    const base = {
      raffle_id: raffle.id,
      user_id: userId,
      buyer_name: buyerName || "Membro",
      buyer_email: buyerEmail || null,
      buyer_phone: buyerPhone || null,
      amount_cents: raffle.ticket_price_cents,
      status: "reserved",
      note: note.trim() || null,
      label: label.trim() || null,
    };
    const rows = useNumbers ? selected.map((n) => ({ ...base, number: n })) : [{ ...base, number: null }];
    setSaving(true);
    const { error } = await supabase.from("raffle_tickets").insert(rows as any);
    setSaving(false);
    if (error) {
      return toast.error(
        error.message.includes("duplicate") ? "Algum número foi reservado por outra pessoa. Atualize e tente de novo." : error.message,
      );
    }
    toast.success("Reserva feita! Pague pelo Pix e envie o comprovante.");
    setSelected([]);
    setLabel("");
    setNote("");
    qc.invalidateQueries({ queryKey: ["raffle-tickets", raffle.id] });
    onReserved();
  };

  return (
    <Dialog open={!!raffle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{raffle?.title}</DialogTitle>
          <DialogDescription>{raffle?.reason || "Participe escolhendo seus números."}</DialogDescription>
        </DialogHeader>

        {raffle && (
          <div className="space-y-5">
            {raffle.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{raffle.description}</p>}

            {prizes.length > 0 && (
              <div>
                <Label className="text-xs tracking-widest text-muted-foreground">PRÊMIOS</Label>
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  {prizes.map((p, i) => (
                    <div key={p.id} className="rounded-lg border border-border/40 bg-muted/10 p-3 flex gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.title} className="h-12 w-12 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center shrink-0"><Gift className="h-5 w-5 text-primary/50" /></div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{i + 1}º · {p.title}</div>
                        {p.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
                <div className="text-[10px] tracking-widest text-muted-foreground">VALOR</div>
                <div className="text-lg font-black text-primary">{centsToMoneyInput(raffle.ticket_price_cents)}</div>
              </div>
              {raffle.pix_key && (
                <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
                  <div className="text-[10px] tracking-widest text-muted-foreground">CHAVE PIX</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono truncate">{raffle.pix_key}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => { navigator.clipboard.writeText(raffle.pix_key!); toast.success("Chave Pix copiada"); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {raffle.entry_mode === "name" ? (
              <div>
                <Label>Nome na rifa</Label>
                <Input maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Como quer aparecer na lista" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Escolha seus números</Label>
                  <span className="text-[11px] text-muted-foreground">
                    {taken.size}/{raffle.total_numbers} ocupados{limit ? ` · limite ${limit} por pessoa` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {Array.from({ length: raffle.total_numbers }, (_, i) => i + 1).map((n) => {
                    const t = taken.get(n);
                    const isMine = t?.user_id === userId;
                    const on = selected.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={!!t || !isOpen}
                        onClick={() => toggle(n)}
                        title={t ? `${t.buyer_name} · ${TICKET_STATUS[t.status]?.label ?? t.status}` : `Número ${n}`}
                        className={cn(
                          "h-9 rounded-md border text-xs font-bold transition",
                          t
                            ? isMine
                              ? "border-primary/50 bg-primary/20 text-primary cursor-not-allowed"
                              : "border-border/40 bg-muted/30 text-muted-foreground/50 line-through cursor-not-allowed"
                            : on
                            ? "border-primary bg-primary text-background"
                            : "border-border/50 hover:border-primary/50 hover:text-primary",
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isOpen && (
              <div>
                <Label>Observação (opcional)</Label>
                <Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: paguei pelo Pix às 14h" />
              </div>
            )}

            {!isOpen && (
              <p className="text-xs text-amber-400">Esta rifa não está aberta para novas reservas.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {isOpen && (
            <Button onClick={reserve} disabled={saving}>
              <Ticket className="h-4 w-4 mr-1" />
              {saving ? "Reservando…" : `Reservar${total > 0 ? ` · ${centsToMoneyInput(total)}` : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
