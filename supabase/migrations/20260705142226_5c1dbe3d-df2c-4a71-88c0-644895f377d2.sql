
-- Extend drops catalog with product details
ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS product_category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS available_sizes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS size_measurements jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Extend drop_interests with order/finance data
ALTER TABLE public.drop_interests
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Require authenticated user to reserve a drop
DROP POLICY IF EXISTS "drop_interests public insert" ON public.drop_interests;
CREATE POLICY "drop_interests authenticated insert"
  ON public.drop_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Allow admin to update orders (status, linked_user_id, etc.)
DROP POLICY IF EXISTS "drop_interests admin update" ON public.drop_interests;
CREATE POLICY "drop_interests admin update"
  ON public.drop_interests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_drop_interests_updated_at ON public.drop_interests;
CREATE TRIGGER trg_drop_interests_updated_at
  BEFORE UPDATE ON public.drop_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log for admin updates (status / linked_user_id)
CREATE OR REPLACE FUNCTION public.log_drop_interest_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _title text;
BEGIN
  SELECT title INTO _title FROM public.drops WHERE id = NEW.drop_id;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
    VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
      'DROP_INTEREST_STATUS_CHANGED', 'drop_interests', NEW.id::text,
      'Pedido "' || COALESCE(_title, NEW.drop_id::text) || '" (' || NEW.full_name || '): ' || OLD.status || ' → ' || NEW.status);
  END IF;
  IF NEW.linked_user_id IS DISTINCT FROM OLD.linked_user_id THEN
    INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
    VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
      'DROP_INTEREST_LINKED', 'drop_interests', NEW.id::text,
      'Vinculou pedido de ' || NEW.full_name || ' ao usuário ' || COALESCE(NEW.linked_user_id::text, 'nenhum'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_drop_interest_update ON public.drop_interests;
CREATE TRIGGER trg_log_drop_interest_update
  AFTER UPDATE ON public.drop_interests
  FOR EACH ROW EXECUTE FUNCTION public.log_drop_interest_update();
