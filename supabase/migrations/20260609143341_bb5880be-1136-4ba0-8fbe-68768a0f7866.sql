
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS speakers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS online_link text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS max_attendees integer;

CREATE TABLE IF NOT EXISTS public.event_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'self',
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checkins TO authenticated;
GRANT ALL ON public.event_checkins TO service_role;

ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin_self_select" ON public.event_checkins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "checkin_self_insert" ON public.event_checkins
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "checkin_self_delete" ON public.event_checkins
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS event_checkins_event_idx ON public.event_checkins(event_id);
CREATE INDEX IF NOT EXISTS event_checkins_user_idx ON public.event_checkins(user_id);

CREATE OR REPLACE FUNCTION public.log_event_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _event_name text;
BEGIN
  SELECT display_name INTO _name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  SELECT name INTO _event_name FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
  VALUES (NEW.user_id, _name, 'EVENT_CHECKIN', 'events', NEW.event_id::text,
          'Check-in em: ' || COALESCE(_event_name, NEW.event_id::text));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_event_checkin ON public.event_checkins;
CREATE TRIGGER trg_log_event_checkin
  AFTER INSERT ON public.event_checkins
  FOR EACH ROW EXECUTE FUNCTION public.log_event_checkin();
