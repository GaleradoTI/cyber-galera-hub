ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS end_time time without time zone;

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  ticket_code text NOT NULL UNIQUE,
  note text,
  decided_by uuid,
  decided_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own registrations readable" ON public.event_registrations
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_event_registrations_updated BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_event_registrations_event ON public.event_registrations(event_id, status);

CREATE OR REPLACE FUNCTION public._gen_ticket_code() RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; _c text; _i int;
BEGIN
  LOOP
    _c := 'GTI-';
    FOR _i IN 1..4 LOOP _c := _c || substr(_chars, 1 + floor(random()*32)::int, 1); END LOOP;
    _c := _c || '-';
    FOR _i IN 1..2 LOOP _c := _c || substr(_chars, 1 + floor(random()*32)::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.event_registrations WHERE ticket_code = _c);
  END LOOP;
  RETURN _c;
END $$;

CREATE OR REPLACE FUNCTION public.register_for_event(_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _ev public.events; _approved int; _status text; _row public.event_registrations;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Faça login para se inscrever'; END IF;
  SELECT * INTO _ev FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR _ev.status <> 'publicado' THEN RAISE EXCEPTION 'Evento indisponível'; END IF;
  SELECT * INTO _row FROM public.event_registrations WHERE event_id = _event_id AND user_id = _uid;
  IF FOUND AND _row.status NOT IN ('cancelled','rejected') THEN RETURN to_jsonb(_row); END IF;
  SELECT count(*) INTO _approved FROM public.event_registrations WHERE event_id = _event_id AND status = 'approved';
  IF _ev.max_attendees IS NOT NULL AND _approved >= _ev.max_attendees THEN _status := 'waitlist';
  ELSIF _ev.requires_approval THEN _status := 'pending';
  ELSE _status := 'approved'; END IF;
  IF FOUND THEN
    UPDATE public.event_registrations SET status = _status, decided_by = NULL, decided_at = CASE WHEN _status='approved' THEN now() END
      WHERE id = _row.id RETURNING * INTO _row;
  ELSE
    INSERT INTO public.event_registrations(event_id, user_id, status, ticket_code, decided_at)
      VALUES (_event_id, _uid, _status, public._gen_ticket_code(), CASE WHEN _status='approved' THEN now() END)
      RETURNING * INTO _row;
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
    VALUES (_uid, public._audit_actor_name(_uid), 'event_registration', 'event', _event_id::text, 'Inscrição: ' || _status);
  RETURN to_jsonb(_row);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_event_registration(_event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _next uuid; _ev public.events;
BEGIN
  UPDATE public.event_registrations SET status = 'cancelled' WHERE event_id = _event_id AND user_id = _uid AND checked_in_at IS NULL;
  SELECT * INTO _ev FROM public.events WHERE id = _event_id;
  SELECT id INTO _next FROM public.event_registrations WHERE event_id = _event_id AND status = 'waitlist' ORDER BY created_at LIMIT 1;
  IF _next IS NOT NULL THEN
    UPDATE public.event_registrations SET status = CASE WHEN _ev.requires_approval THEN 'pending' ELSE 'approved' END WHERE id = _next;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.decide_registration(_ids uuid[], _status text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _r public.event_registrations; _n int := 0; _ev public.events;
BEGIN
  IF NOT public.is_admin_or_super(_uid) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _status NOT IN ('approved','rejected','pending','waitlist') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  FOR _r IN SELECT * FROM public.event_registrations WHERE id = ANY(_ids) LOOP
    UPDATE public.event_registrations SET status = _status, decided_by = _uid, decided_at = now() WHERE id = _r.id;
    SELECT * INTO _ev FROM public.events WHERE id = _r.event_id;
    IF _status IN ('approved','rejected') THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
      VALUES (_r.user_id, 'event_registration',
        CASE WHEN _status='approved' THEN 'Presença aprovada: ' ELSE 'Inscrição não aprovada: ' END || _ev.name,
        CASE WHEN _status='approved' THEN 'Seu ingresso com QR Code está em Meus eventos.' ELSE NULL END,
        '/dashboard/meus-eventos');
    END IF;
    _n := _n + 1;
  END LOOP;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
    VALUES (_uid, public._audit_actor_name(_uid), 'decide_registration', 'event_registration', NULL, _status || ' x' || _n);
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_by_code(_code text, _event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _r public.event_registrations; _p public.profiles; _already boolean := false;
BEGIN
  IF NOT public.is_admin_or_super(_uid) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO _r FROM public.event_registrations WHERE ticket_code = upper(trim(_code)) AND event_id = _event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','not_found'); END IF;
  SELECT * INTO _p FROM public.profiles WHERE user_id = _r.user_id;
  IF _r.status <> 'approved' THEN
    RETURN jsonb_build_object('result','not_approved','status',_r.status,'name',_p.display_name,'avatar_url',_p.avatar_url);
  END IF;
  IF _r.checked_in_at IS NOT NULL THEN _already := true;
  ELSE
    UPDATE public.event_registrations SET checked_in_at = now(), checked_in_by = _uid WHERE id = _r.id RETURNING * INTO _r;
    INSERT INTO public.event_checkins(event_id, user_id, source) VALUES (_r.event_id, _r.user_id, 'qrcode') ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('result', CASE WHEN _already THEN 'already' ELSE 'ok' END,
    'name',_p.display_name,'avatar_url',_p.avatar_url,'work_area',_p.work_area,'checked_in_at',_r.checked_in_at);
END $$;

REVOKE EXECUTE ON FUNCTION public._gen_ticket_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_for_event(uuid), public.cancel_event_registration(uuid),
  public.decide_registration(uuid[], text), public.checkin_by_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_for_event(uuid), public.cancel_event_registration(uuid),
  public.decide_registration(uuid[], text), public.checkin_by_code(text, uuid) TO authenticated;