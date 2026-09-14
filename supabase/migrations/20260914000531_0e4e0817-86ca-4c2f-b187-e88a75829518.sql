-- 1) RIFAS
CREATE TABLE public.raffles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  reason text,
  description text,
  ticket_price_cents integer NOT NULL DEFAULT 0,
  pix_key text,
  payment_methods text[] NOT NULL DEFAULT ARRAY['Pix']::text[],
  total_numbers integer NOT NULL DEFAULT 100,
  entry_mode text NOT NULL DEFAULT 'number',
  max_per_user integer,
  draw_date timestamptz,
  cover_url text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffles TO authenticated;
GRANT ALL ON public.raffles TO service_role;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Raffles readable by members" ON public.raffles
  FOR SELECT TO authenticated
  USING (status <> 'draft' OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins insert raffles" ON public.raffles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins update raffles" ON public.raffles
  FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins delete raffles" ON public.raffles
  FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_raffles_updated_at BEFORE UPDATE ON public.raffles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) PRÊMIOS
CREATE TABLE public.raffle_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  winner_ticket_id uuid,
  drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffle_prizes TO authenticated;
GRANT ALL ON public.raffle_prizes TO service_role;
ALTER TABLE public.raffle_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prizes readable by members" ON public.raffle_prizes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.raffles r WHERE r.id = raffle_id
                 AND (r.status <> 'draft' OR public.is_admin_or_super(auth.uid()))));
CREATE POLICY "Admins insert prizes" ON public.raffle_prizes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins update prizes" ON public.raffle_prizes
  FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins delete prizes" ON public.raffle_prizes
  FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_raffle_prizes_updated_at BEFORE UPDATE ON public.raffle_prizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) NÚMEROS / RESERVAS
CREATE TABLE public.raffle_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  number integer,
  label text,
  user_id uuid,
  buyer_name text NOT NULL,
  buyer_email text,
  buyer_phone text,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reserved',
  receipt_url text,
  note text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX raffle_tickets_unique_number
  ON public.raffle_tickets (raffle_id, number)
  WHERE number IS NOT NULL AND status <> 'cancelled';
CREATE INDEX raffle_tickets_raffle_idx ON public.raffle_tickets (raffle_id, created_at DESC);
CREATE INDEX raffle_tickets_user_idx ON public.raffle_tickets (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffle_tickets TO authenticated;
GRANT ALL ON public.raffle_tickets TO service_role;
ALTER TABLE public.raffle_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tickets readable by members" ON public.raffle_tickets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.raffles r WHERE r.id = raffle_id
                 AND (r.status <> 'draft' OR public.is_admin_or_super(auth.uid()))));
CREATE POLICY "Users reserve own tickets" ON public.raffle_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'reserved'
    AND is_winner = false
    AND EXISTS (SELECT 1 FROM public.raffles r WHERE r.id = raffle_id AND r.status = 'open')
  );
CREATE POLICY "Users update own reserved tickets" ON public.raffle_tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'reserved')
  WITH CHECK (user_id = auth.uid() AND status = 'reserved' AND is_winner = false);
CREATE POLICY "Admins manage tickets" ON public.raffle_tickets
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users cancel own reserved tickets" ON public.raffle_tickets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'reserved');

CREATE TRIGGER update_raffle_tickets_updated_at BEFORE UPDATE ON public.raffle_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.raffle_prizes
  ADD CONSTRAINT raffle_prizes_winner_fk
  FOREIGN KEY (winner_ticket_id) REFERENCES public.raffle_tickets(id) ON DELETE SET NULL;

-- 4) FINANCEIRO
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS raffle_ticket_id uuid REFERENCES public.raffle_tickets(id) ON DELETE SET NULL;

-- corrige auditoria financeira: tabelas sem coluna "title" quebravam o gatilho
CREATE OR REPLACE FUNCTION public.audit_finance_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row record; _action text; _entity text := TG_TABLE_NAME; _diff jsonb; _label text;
BEGIN
  _row := COALESCE(NEW, OLD);
  _action := CASE TG_OP WHEN 'INSERT' THEN upper(_entity)||'_CREATED'
                        WHEN 'UPDATE' THEN upper(_entity)||'_UPDATED'
                        ELSE upper(_entity)||'_DELETED' END;
  _diff := jsonb_build_object(
    'before', CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    'after',  CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  _label := COALESCE(to_jsonb(_row)->>'name', to_jsonb(_row)->>'title', _row.id::text);
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description, diff)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action, _entity, _row.id::text, _label, _diff);
  RETURN _row;
END $$;

INSERT INTO public.finance_categories (name, kind, color, display_order)
VALUES ('Rifas', 'RECEITA', '#22d3ee', 8)
ON CONFLICT (name, kind) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_raffle_ticket_to_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  _cat_id uuid;
  _title text;
  _status text;
BEGIN
  SELECT id INTO _cat_id FROM public.finance_categories WHERE name='Rifas' AND kind='RECEITA' LIMIT 1;
  SELECT title INTO _title FROM public.raffles WHERE id = NEW.raffle_id;
  _status := CASE WHEN NEW.status = 'paid' THEN 'confirmed'
                  WHEN NEW.status = 'cancelled' THEN 'cancelled'
                  ELSE 'pending' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.finance_entries
      (kind, category_id, title, amount_cents, entry_date, status,
       counterparty_name, counterparty_email, counterparty_phone,
       linked_user_id, raffle_ticket_id, created_by, note)
    VALUES ('RECEITA', _cat_id,
            'Rifa: ' || COALESCE(_title, NEW.raffle_id::text) ||
              COALESCE(' · nº ' || NEW.number::text, COALESCE(' · ' || NEW.label, '')),
            COALESCE(NEW.amount_cents, 0),
            COALESCE(NEW.created_at::date, CURRENT_DATE),
            _status,
            NEW.buyer_name, NEW.buyer_email, NEW.buyer_phone,
            NEW.user_id, NEW.id, auth.uid(), NEW.note);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.finance_entries SET
      amount_cents = COALESCE(NEW.amount_cents, 0),
      status = _status,
      counterparty_name = NEW.buyer_name,
      counterparty_email = NEW.buyer_email,
      counterparty_phone = NEW.buyer_phone,
      linked_user_id = NEW.user_id
    WHERE raffle_ticket_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_raffle_ticket_to_finance
  AFTER INSERT OR UPDATE ON public.raffle_tickets
  FOR EACH ROW EXECUTE FUNCTION public.sync_raffle_ticket_to_finance();

-- 5) AUDITORIA
CREATE OR REPLACE FUNCTION public.log_raffle_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), TG_OP, TG_TABLE_NAME,
          COALESCE(NEW.id, OLD.id)::text,
          CASE TG_TABLE_NAME
            WHEN 'raffles' THEN COALESCE(NEW.title, OLD.title)
            WHEN 'raffle_prizes' THEN 'Prêmio: ' || COALESCE(NEW.title, OLD.title)
            ELSE 'Número ' || COALESCE(NEW.number, OLD.number)::text || ' — ' ||
                 COALESCE(NEW.status, OLD.status)
          END);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_log_raffles AFTER INSERT OR UPDATE OR DELETE ON public.raffles
  FOR EACH ROW EXECUTE FUNCTION public.log_raffle_changes();
CREATE TRIGGER trg_log_raffle_prizes AFTER INSERT OR UPDATE OR DELETE ON public.raffle_prizes
  FOR EACH ROW EXECUTE FUNCTION public.log_raffle_changes();
CREATE TRIGGER trg_log_raffle_tickets AFTER INSERT OR UPDATE OR DELETE ON public.raffle_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_raffle_changes();

-- 6) SORTEIO
CREATE OR REPLACE FUNCTION public.draw_raffle(_raffle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  _prize record;
  _ticket record;
  _results jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  FOR _prize IN
    SELECT * FROM public.raffle_prizes
    WHERE raffle_id = _raffle_id AND winner_ticket_id IS NULL
    ORDER BY display_order, created_at
  LOOP
    SELECT t.* INTO _ticket
    FROM public.raffle_tickets t
    WHERE t.raffle_id = _raffle_id
      AND t.status = 'paid'
      AND t.is_winner = false
    ORDER BY random()
    LIMIT 1;

    EXIT WHEN _ticket IS NULL;

    UPDATE public.raffle_tickets SET is_winner = true WHERE id = _ticket.id;
    UPDATE public.raffle_prizes SET winner_ticket_id = _ticket.id, drawn_at = now()
      WHERE id = _prize.id;

    _results := _results || jsonb_build_object(
      'prize_id', _prize.id, 'prize_title', _prize.title,
      'ticket_id', _ticket.id, 'number', _ticket.number,
      'label', _ticket.label, 'winner', _ticket.buyer_name);
    _ticket := NULL;
  END LOOP;

  UPDATE public.raffles SET status = 'drawn' WHERE id = _raffle_id
    AND NOT EXISTS (SELECT 1 FROM public.raffle_prizes p WHERE p.raffle_id = _raffle_id AND p.winner_ticket_id IS NULL);

  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description, diff)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), 'DRAW', 'raffles', _raffle_id::text,
          'Sorteio realizado', _results);

  RETURN _results;
END $$;

REVOKE EXECUTE ON FUNCTION public.draw_raffle(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.draw_raffle(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_raffle_ticket_to_finance() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_raffle_changes() FROM anon, authenticated;