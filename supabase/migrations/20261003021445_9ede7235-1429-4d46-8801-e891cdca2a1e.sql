CREATE OR REPLACE FUNCTION public._notify_event_reg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev public.events; _name text; _title text; _body text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT * INTO _ev FROM public.events WHERE id = NEW.event_id;
  _title := CASE NEW.status
    WHEN 'pending' THEN 'Pedido de presença recebido: '
    WHEN 'approved' THEN 'Presença confirmada: '
    WHEN 'rejected' THEN 'Inscrição não aprovada: '
    WHEN 'waitlist' THEN 'Você está na lista de espera: '
    WHEN 'cancelled' THEN 'Presença cancelada: ' END || _ev.name;
  _body := CASE NEW.status
    WHEN 'pending' THEN 'A organização vai analisar seu pedido. Você será avisado aqui.'
    WHEN 'approved' THEN 'Seu ingresso com QR Code (' || NEW.ticket_code || ') está disponível. Apresente-o na entrada.'
    WHEN 'rejected' THEN 'Infelizmente seu pedido não foi aprovado desta vez.'
    WHEN 'waitlist' THEN 'As vagas esgotaram. Avisaremos se uma vaga for liberada.'
    ELSE NULL END;
  IF _title IS NOT NULL AND NOT (NEW.status = 'cancelled' AND NEW.user_id = auth.uid()) THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (NEW.user_id, 'event_registration', _title, _body, '/eventos/' || NEW.event_id);
  END IF;
  IF NEW.status = 'pending' AND NEW.user_id = auth.uid() THEN
    SELECT display_name INTO _name FROM public.profiles WHERE user_id = NEW.user_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT DISTINCT ur.user_id, 'event_registration_admin', 'Novo pedido de presença: ' || _ev.name,
      coalesce(_name, 'Um membro') || ' quer participar.', '/dashboard/evento-inscricoes/' || NEW.event_id
    FROM public.user_roles ur WHERE ur.role IN ('ADMIN','SUPER_ADMIN');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public._notify_event_reg() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_event_reg AFTER INSERT OR UPDATE OF status ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public._notify_event_reg();

-- remove notificação duplicada da RPC (agora feita pelo trigger)
CREATE OR REPLACE FUNCTION public.decide_registration(_ids uuid[], _status text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _n int;
BEGIN
  IF NOT public.is_admin_or_super(_uid) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _status NOT IN ('approved','rejected','pending','waitlist') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  UPDATE public.event_registrations SET status = _status, decided_by = _uid, decided_at = now() WHERE id = ANY(_ids);
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
    VALUES (_uid, public._audit_actor_name(_uid), 'decide_registration', 'event_registration', NULL, _status || ' x' || _n);
  RETURN _n;
END $$;