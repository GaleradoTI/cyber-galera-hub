
-- Enum de tipo de lançamento
DO $$ BEGIN
  CREATE TYPE public.finance_entry_kind AS ENUM ('RECEITA', 'DESPESA', 'DOACAO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Categorias
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.finance_entry_kind NOT NULL,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_cat_admin_all" ON public.finance_categories FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER trg_fin_cat_upd BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Tags
CREATE TABLE IF NOT EXISTS public.finance_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tags TO authenticated;
GRANT ALL ON public.finance_tags TO service_role;
ALTER TABLE public.finance_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_tag_admin_all" ON public.finance_tags FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 3) Lançamentos
CREATE TABLE IF NOT EXISTS public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.finance_entry_kind NOT NULL,
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  amount_cents bigint NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','cancelled')),
  payment_method text,
  counterparty_name text,
  counterparty_email text,
  counterparty_phone text,
  linked_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  drop_interest_id uuid REFERENCES public.drop_interests(id) ON DELETE CASCADE,
  attachment_url text,
  note text,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drop_interest_id)
);
CREATE INDEX IF NOT EXISTS idx_fin_entries_date ON public.finance_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_entries_kind ON public.finance_entries(kind);
CREATE INDEX IF NOT EXISTS idx_fin_entries_category ON public.finance_entries(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_entry_admin_all" ON public.finance_entries FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER trg_fin_entry_upd BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Junção entry ↔ tag
CREATE TABLE IF NOT EXISTS public.finance_entry_tags (
  entry_id uuid NOT NULL REFERENCES public.finance_entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.finance_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entry_tags TO authenticated;
GRANT ALL ON public.finance_entry_tags TO service_role;
ALTER TABLE public.finance_entry_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_entry_tags_admin_all" ON public.finance_entry_tags FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 5) Audit triggers
CREATE OR REPLACE FUNCTION public.log_finance_entry_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE _row record; _action text; _amt text;
BEGIN
  _row := COALESCE(NEW, OLD);
  _amt := 'R$ ' || to_char((_row.amount_cents::numeric/100), 'FM999G999G990D00');
  _action := CASE TG_OP WHEN 'INSERT' THEN 'FINANCE_ENTRY_CREATED'
                       WHEN 'DELETE' THEN 'FINANCE_ENTRY_DELETED'
                       ELSE 'FINANCE_ENTRY_UPDATED' END;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action,
          'finance_entries', _row.id::text,
          _row.kind::text || ' — ' || _row.title || ' (' || _amt || ')');
  RETURN _row;
END $$;
CREATE TRIGGER trg_fin_entry_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.log_finance_entry_changes();

CREATE OR REPLACE FUNCTION public.log_finance_category_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE _row record; _action text;
BEGIN
  _row := COALESCE(NEW, OLD);
  _action := CASE TG_OP WHEN 'INSERT' THEN 'FINANCE_CATEGORY_CREATED'
                       WHEN 'DELETE' THEN 'FINANCE_CATEGORY_DELETED'
                       ELSE 'FINANCE_CATEGORY_UPDATED' END;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action,
          'finance_categories', _row.id::text,
          'Categoria ' || _row.kind::text || ': ' || _row.name);
  RETURN _row;
END $$;
CREATE TRIGGER trg_fin_cat_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.log_finance_category_changes();

CREATE OR REPLACE FUNCTION public.log_finance_tag_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE _row record; _action text;
BEGIN
  _row := COALESCE(NEW, OLD);
  _action := CASE TG_OP WHEN 'INSERT' THEN 'FINANCE_TAG_CREATED'
                       WHEN 'DELETE' THEN 'FINANCE_TAG_DELETED'
                       ELSE 'FINANCE_TAG_UPDATED' END;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action,
          'finance_tags', _row.id::text, 'Tag: ' || _row.name);
  RETURN _row;
END $$;
CREATE TRIGGER trg_fin_tag_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_tags
  FOR EACH ROW EXECUTE FUNCTION public.log_finance_tag_changes();

-- 6) Seed categorias
INSERT INTO public.finance_categories (name, kind, color, display_order) VALUES
  ('Drops', 'RECEITA', '#10b981', 1),
  ('Torneio', 'RECEITA', '#3b82f6', 2),
  ('Serviço prestado', 'RECEITA', '#8b5cf6', 3),
  ('Doação recebida', 'DOACAO', '#f59e0b', 4),
  ('Infraestrutura', 'DESPESA', '#ef4444', 5),
  ('Marketing', 'DESPESA', '#ec4899', 6),
  ('Material', 'DESPESA', '#f97316', 7)
ON CONFLICT (name, kind) DO NOTHING;

-- 7) Sync drops → finance
CREATE OR REPLACE FUNCTION public.sync_drop_interest_to_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  _cat_id uuid;
  _drop_title text;
  _new_status text;
BEGIN
  SELECT id INTO _cat_id FROM public.finance_categories
    WHERE name = 'Drops' AND kind = 'RECEITA' LIMIT 1;
  SELECT title INTO _drop_title FROM public.drops WHERE id = NEW.drop_id;
  _new_status := CASE WHEN NEW.status IN ('paid','delivered') THEN 'confirmed'
                      WHEN NEW.status = 'cancelled' THEN 'cancelled'
                      ELSE 'pending' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.finance_entries
      (kind, category_id, title, amount_cents, entry_date, status,
       counterparty_name, counterparty_email, counterparty_phone,
       linked_user_id, drop_interest_id, created_by)
    VALUES ('RECEITA', _cat_id,
            'Drop: ' || COALESCE(_drop_title, NEW.drop_id::text),
            COALESCE(NEW.amount_cents, 0),
            COALESCE(NEW.created_at::date, CURRENT_DATE),
            _new_status,
            NEW.full_name, NEW.email, NEW.phone,
            COALESCE(NEW.linked_user_id, NEW.user_id),
            NEW.id, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.finance_entries SET
      amount_cents = COALESCE(NEW.amount_cents, 0),
      status = _new_status,
      counterparty_name = NEW.full_name,
      counterparty_email = NEW.email,
      counterparty_phone = NEW.phone,
      linked_user_id = COALESCE(NEW.linked_user_id, NEW.user_id)
    WHERE drop_interest_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_drop_to_finance
  AFTER INSERT OR UPDATE ON public.drop_interests
  FOR EACH ROW EXECUTE FUNCTION public.sync_drop_interest_to_finance();

-- 8) Backfill: gerar finance_entries para drop_interests existentes
INSERT INTO public.finance_entries
  (kind, category_id, title, amount_cents, entry_date, status,
   counterparty_name, counterparty_email, counterparty_phone,
   linked_user_id, drop_interest_id)
SELECT 'RECEITA',
       (SELECT id FROM public.finance_categories WHERE name='Drops' AND kind='RECEITA' LIMIT 1),
       'Drop: ' || COALESCE(d.title, di.drop_id::text),
       COALESCE(di.amount_cents, 0),
       di.created_at::date,
       CASE WHEN di.status IN ('paid','delivered') THEN 'confirmed'
            WHEN di.status = 'cancelled' THEN 'cancelled'
            ELSE 'pending' END,
       di.full_name, di.email, di.phone,
       COALESCE(di.linked_user_id, di.user_id),
       di.id
FROM public.drop_interests di
LEFT JOIN public.drops d ON d.id = di.drop_id
WHERE NOT EXISTS (SELECT 1 FROM public.finance_entries fe WHERE fe.drop_interest_id = di.id);
