
-- ============ 1) squad_goals: description + tasks ============
ALTER TABLE public.squad_goals
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tasks jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.toggle_goal_task(_goal_id uuid, _task_id text, _done boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _goal public.squad_goals;
  _allowed boolean;
  _new jsonb;
  _uid uuid := auth.uid();
BEGIN
  SELECT * INTO _goal FROM public.squad_goals WHERE id = _goal_id;
  IF _goal.id IS NULL THEN RAISE EXCEPTION 'Meta não encontrada'; END IF;
  _allowed := public.is_admin_or_super(_uid)
              OR (_goal.squad_id IS NOT NULL AND public.is_squad_leader(_uid, _goal.squad_id))
              OR public.is_project_leader(_uid, _goal.project_id);
  IF NOT _allowed THEN RAISE EXCEPTION 'Apenas líderes podem marcar tasks'; END IF;

  SELECT jsonb_agg(
    CASE WHEN (t->>'id') = _task_id
      THEN jsonb_set(jsonb_set(jsonb_set(t,
            '{done}', to_jsonb(_done)),
            '{done_by}', CASE WHEN _done THEN to_jsonb(_uid::text) ELSE 'null'::jsonb END),
            '{done_at}', CASE WHEN _done THEN to_jsonb(now()) ELSE 'null'::jsonb END)
      ELSE t END
  ) INTO _new
  FROM jsonb_array_elements(COALESCE(_goal.tasks,'[]'::jsonb)) t;

  UPDATE public.squad_goals SET tasks = COALESCE(_new,'[]'::jsonb), updated_at = now() WHERE id = _goal_id;

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (_uid, public._audit_actor_name(_uid),
          CASE WHEN _done THEN 'SQUAD_GOAL_TASK_DONE' ELSE 'SQUAD_GOAL_TASK_UNDONE' END,
          'squad_goals', _goal_id::text,
          'Task ' || _task_id || ' em "' || _goal.title || '"');
END $$;

GRANT EXECUTE ON FUNCTION public.toggle_goal_task(uuid, text, boolean) TO authenticated;

-- ============ 2) drops + drop_interests ============
CREATE TABLE IF NOT EXISTS public.drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  launch_date timestamptz,
  status text NOT NULL DEFAULT 'draft', -- draft | published | closed
  pix_key text,
  payment_methods text[] NOT NULL DEFAULT ARRAY[]::text[],
  images text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.drops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drops TO authenticated;
GRANT ALL ON public.drops TO service_role;

ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drops public read published" ON public.drops;
CREATE POLICY "drops public read published" ON public.drops FOR SELECT
  USING (status = 'published' OR public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "drops admin insert" ON public.drops;
CREATE POLICY "drops admin insert" ON public.drops FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "drops admin update" ON public.drops;
CREATE POLICY "drops admin update" ON public.drops FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "drops admin delete" ON public.drops;
CREATE POLICY "drops admin delete" ON public.drops FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_drops_updated_at
  BEFORE UPDATE ON public.drops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.drop_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS drop_interests_user_unique
  ON public.drop_interests(drop_id, user_id) WHERE user_id IS NOT NULL;

GRANT SELECT, INSERT ON public.drop_interests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drop_interests TO authenticated;
GRANT ALL ON public.drop_interests TO service_role;

ALTER TABLE public.drop_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drop_interests admin read" ON public.drop_interests;
CREATE POLICY "drop_interests admin read" ON public.drop_interests FOR SELECT
  USING (public.is_admin_or_super(auth.uid()) OR (user_id IS NOT NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "drop_interests public insert" ON public.drop_interests;
CREATE POLICY "drop_interests public insert" ON public.drop_interests FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "drop_interests admin manage" ON public.drop_interests;
CREATE POLICY "drop_interests admin manage" ON public.drop_interests FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- ============ 3) audit triggers para drops ============
CREATE OR REPLACE FUNCTION public.log_drop_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record; _action text;
BEGIN
  _row := COALESCE(NEW, OLD);
  IF TG_OP = 'INSERT' THEN _action := 'DROP_CREATED';
  ELSIF TG_OP = 'DELETE' THEN _action := 'DROP_DELETED';
  ELSE _action := 'DROP_UPDATED';
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action, 'drops', _row.id::text,
    CASE WHEN TG_OP='DELETE' THEN 'Removeu drop: '||OLD.title
         WHEN TG_OP='INSERT' THEN 'Criou drop: '||NEW.title
         ELSE 'Atualizou drop: '||NEW.title END);
  RETURN _row;
END $$;

DROP TRIGGER IF EXISTS trg_log_drops ON public.drops;
CREATE TRIGGER trg_log_drops
  AFTER INSERT OR UPDATE OR DELETE ON public.drops
  FOR EACH ROW EXECUTE FUNCTION public.log_drop_changes();

CREATE OR REPLACE FUNCTION public.log_drop_interest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text;
BEGIN
  SELECT title INTO _title FROM public.drops WHERE id = NEW.drop_id;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (NEW.user_id, COALESCE(public._audit_actor_name(NEW.user_id), NEW.full_name),
          'DROP_INTEREST', 'drop_interests', NEW.id::text,
          'Interesse no drop "' || COALESCE(_title, NEW.drop_id::text) || '" por ' || NEW.full_name);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_drop_interest ON public.drop_interests;
CREATE TRIGGER trg_log_drop_interest
  AFTER INSERT ON public.drop_interests
  FOR EACH ROW EXECUTE FUNCTION public.log_drop_interest();
