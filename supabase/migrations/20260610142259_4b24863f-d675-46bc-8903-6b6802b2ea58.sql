
-- 1) New columns on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'comunidade',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_source_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_source_check CHECK (source IN ('comunidade','terceiros'));
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_approval_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_approval_check CHECK (approval_status IN ('pending','approved','rejected'));

-- 2) Update events RLS: allow members/recruiters to submit (pending only)
DROP POLICY IF EXISTS "Admins manage events - insert" ON public.events;
CREATE POLICY "Admins insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users submit events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin_or_super(auth.uid())
    AND submitted_by = auth.uid()
    AND approval_status = 'pending'
    AND status = 'rascunho'
  );

-- Submitter may update their own pending event
CREATE POLICY "Submitter updates own pending"
  ON public.events FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending')
  WITH CHECK (submitted_by = auth.uid() AND approval_status = 'pending');

CREATE POLICY "Submitter deletes own pending"
  ON public.events FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending');

-- Submitter sees own events even if not published
DROP POLICY IF EXISTS "Submitter sees own events" ON public.events;
CREATE POLICY "Submitter sees own events"
  ON public.events FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- Update public read policy to hide non-approved
DROP POLICY IF EXISTS "Published events are public" ON public.events;
CREATE POLICY "Published events are public"
  ON public.events FOR SELECT
  USING (
    (status = 'publicado' AND approval_status = 'approved')
    OR public.is_admin_or_super(auth.uid())
  );

-- 3) Trigger to enforce submission rules and log
CREATE OR REPLACE FUNCTION public.events_submission_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin_or_super(auth.uid()) THEN
      NEW.approval_status := 'pending';
      NEW.status := 'rascunho';
      NEW.submitted_by := auth.uid();
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    ELSE
      IF NEW.submitted_by IS NULL THEN NEW.submitted_by := auth.uid(); END IF;
      IF NEW.approval_status = 'approved' AND NEW.approved_at IS NULL THEN
        NEW.approved_by := auth.uid();
        NEW.approved_at := now();
      END IF;
    END IF;
    SELECT display_name INTO _name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
    VALUES (auth.uid(), _name,
            CASE WHEN NEW.approval_status='pending' THEN 'EVENT_SUBMITTED' ELSE 'EVENT_CREATED' END,
            'events', NEW.id::text,
            'Evento ' || NEW.name || ' (' || NEW.source || ')');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      IF NOT public.is_admin_or_super(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar o status de aprovação';
      END IF;
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
      SELECT display_name INTO _name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
      INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
      VALUES (auth.uid(), _name,
              CASE WHEN NEW.approval_status='approved' THEN 'EVENT_APPROVED'
                   WHEN NEW.approval_status='rejected' THEN 'EVENT_REJECTED'
                   ELSE 'EVENT_UPDATED' END,
              'events', NEW.id::text,
              'Evento ' || NEW.name || ' → ' || NEW.approval_status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_submission_guard ON public.events;
CREATE TRIGGER trg_events_submission_guard
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_submission_guard();

-- 4) Waitlist table
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_waitlist TO authenticated;
GRANT ALL ON public.event_waitlist TO service_role;

ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_self_select" ON public.event_waitlist
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "waitlist_self_insert" ON public.event_waitlist
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "waitlist_self_delete" ON public.event_waitlist
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS event_waitlist_event_idx ON public.event_waitlist(event_id, position);

-- 5) Function to register interest with auto-waitlist
CREATE OR REPLACE FUNCTION public.register_event_interest(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _max integer;
  _count integer;
  _pos integer;
  _name text;
  _event_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT max_attendees, name INTO _max, _event_name FROM public.events WHERE id = _event_id;
  IF _event_name IS NULL THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;

  IF _max IS NOT NULL THEN
    SELECT count(*) INTO _count FROM public.user_event_interests WHERE event_id = _event_id;
    IF _count >= _max THEN
      INSERT INTO public.event_waitlist(event_id, user_id, position)
      VALUES (_event_id, _uid, COALESCE((SELECT max(position)+1 FROM public.event_waitlist WHERE event_id=_event_id), 1))
      ON CONFLICT (event_id, user_id) DO NOTHING
      RETURNING position INTO _pos;

      SELECT display_name INTO _name FROM public.profiles WHERE user_id = _uid LIMIT 1;
      INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
      VALUES (_uid, _name, 'EVENT_WAITLIST', 'events', _event_id::text,
              'Entrou na lista de espera de: ' || _event_name);
      RETURN jsonb_build_object('status','waitlist','position', COALESCE(_pos, (SELECT position FROM public.event_waitlist WHERE event_id=_event_id AND user_id=_uid)));
    END IF;
  END IF;

  INSERT INTO public.user_event_interests(event_id, user_id)
  VALUES (_event_id, _uid)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('status','registered');
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_event_interest(uuid) TO authenticated;

-- 6) Promote from waitlist when a spot opens (on interest delete)
CREATE OR REPLACE FUNCTION public.promote_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next record;
  _max integer;
  _count integer;
  _name text;
  _event_name text;
BEGIN
  SELECT max_attendees, name INTO _max, _event_name FROM public.events WHERE id = OLD.event_id;
  IF _max IS NULL THEN RETURN OLD; END IF;
  SELECT count(*) INTO _count FROM public.user_event_interests WHERE event_id = OLD.event_id;
  IF _count >= _max THEN RETURN OLD; END IF;

  SELECT * INTO _next FROM public.event_waitlist
    WHERE event_id = OLD.event_id ORDER BY position ASC LIMIT 1;
  IF _next.id IS NULL THEN RETURN OLD; END IF;

  INSERT INTO public.user_event_interests(event_id, user_id)
  VALUES (OLD.event_id, _next.user_id)
  ON CONFLICT DO NOTHING;
  DELETE FROM public.event_waitlist WHERE id = _next.id;

  SELECT display_name INTO _name FROM public.profiles WHERE user_id = _next.user_id LIMIT 1;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_next.user_id, 'event_waitlist_promoted',
          'Vaga liberada: ' || _event_name,
          'Você foi promovido da lista de espera. Garanta seu check-in!',
          '/dashboard/meus-eventos');
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
  VALUES (_next.user_id, _name, 'EVENT_WAITLIST_PROMOTED', 'events', OLD.event_id::text,
          'Promovido da lista de espera: ' || _event_name);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_from_waitlist ON public.user_event_interests;
CREATE TRIGGER trg_promote_from_waitlist
  AFTER DELETE ON public.user_event_interests
  FOR EACH ROW EXECUTE FUNCTION public.promote_from_waitlist();
