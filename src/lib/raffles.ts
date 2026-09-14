export type Raffle = {
  id: string;
  title: string;
  reason: string | null;
  description: string | null;
  ticket_price_cents: number;
  pix_key: string | null;
  payment_methods: string[];
  total_numbers: number;
  entry_mode: string;
  max_per_user: number | null;
  draw_date: string | null;
  cover_url: string | null;
  status: string;
  created_at: string;
};

export type RafflePrize = {
  id: string;
  raffle_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  winner_ticket_id: string | null;
  drawn_at: string | null;
};

export type RaffleTicket = {
  id: string;
  raffle_id: string;
  number: number | null;
  label: string | null;
  user_id: string | null;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  amount_cents: number;
  status: string;
  receipt_url: string | null;
  note: string | null;
  confirmed_at: string | null;
  is_winner: boolean;
  created_at: string;
};

export const RAFFLE_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "border-muted text-muted-foreground" },
  open: { label: "Aberta", className: "border-emerald-500/50 text-emerald-400" },
  closed: { label: "Encerrada", className: "border-amber-500/50 text-amber-400" },
  drawn: { label: "Sorteada", className: "border-primary/50 text-primary" },
};

export const TICKET_STATUS: Record<string, { label: string; className: string }> = {
  reserved: { label: "Reservado", className: "border-amber-500/50 text-amber-400" },
  paid: { label: "Pago", className: "border-emerald-500/50 text-emerald-400" },
  cancelled: { label: "Cancelado", className: "border-destructive/50 text-destructive" },
};
