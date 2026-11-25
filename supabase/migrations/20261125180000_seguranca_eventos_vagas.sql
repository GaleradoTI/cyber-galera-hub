-- Segurança, inscrições em eventos e ajustes de vagas/recrutador.
-- Pode ser aplicado ANTES do deploy do código novo. Pode ser executado mais de uma vez.
BEGIN;

-- ========== 1) Usuário bloqueado perde o acesso ==========
CREATE OR REPLACE FUNCTION public.is_user_blocked(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND is_blocked)
$$;
REVOKE ALL ON FUNCTION public.is_user_blocked(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_current_user_blocked()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_user_blocked(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_current_user_blocked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_blocked() TO authenticated;

-- Papéis deixam de valer para quem está bloqueado (has_ambassador_permission usa has_role).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
     AND NOT public.is_user_blocked(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ADMIN','SUPER_ADMIN'))
     AND NOT public.is_user_blocked(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_recruiter(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'RECRUTADOR')
     AND NOT public.is_user_blocked(_user_id)
$$;

-- Campos sensíveis do perfil: ninguém se desbloqueia nem troca o e-mail exibido por outro.
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Não é permitido trocar o dono do perfil.';
  END IF;
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
    IF NOT public.is_admin_or_super(uid) OR OLD.user_id = uid THEN
      RAISE EXCEPTION 'Sem permissão para bloquear ou desbloquear.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role::text = 'SUPER_ADMIN') THEN
      RAISE EXCEPTION 'SUPER ADMIN não pode ser bloqueado.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role::text = 'ADMIN')
       AND NOT public.has_role(uid, 'SUPER_ADMIN'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas SUPER ADMIN pode bloquear administradores.';
    END IF;
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email AND NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id AND lower(u.email) = lower(NEW.email)) THEN
    RAISE EXCEPTION 'O e-mail só muda pela troca de e-mail da conta.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS a_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER a_guard_profile_sensitive BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive();

-- Impede novo login e renovação de sessão no Auth.
CREATE OR REPLACE FUNCTION public.sync_auth_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE auth.users SET banned_until = CASE WHEN NEW.is_blocked THEN now() + interval '100 years' END
  WHERE id = NEW.user_id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_auth_ban() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_auth_ban ON public.profiles;
CREATE TRIGGER trg_sync_auth_ban AFTER UPDATE OF is_blocked ON public.profiles
  FOR EACH ROW WHEN (OLD.is_blocked IS DISTINCT FROM NEW.is_blocked)
  EXECUTE FUNCTION public.sync_auth_ban();
UPDATE auth.users u SET banned_until = now() + interval '100 years'
  FROM public.profiles p WHERE p.user_id = u.id AND p.is_blocked;

-- Sessões ainda abertas: política restritiva em todas as tabelas com RLS.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT relname FROM pg_class
           WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity AND relname <> 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Bloqueado sem acesso" ON public.%I', t.relname);
    EXECUTE format('CREATE POLICY "Bloqueado sem acesso" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING (NOT (SELECT public.is_current_user_blocked())) WITH CHECK (NOT (SELECT public.is_current_user_blocked()))', t.relname);
  END LOOP;
END $$;
-- No próprio perfil a leitura continua, para o app saber que deve encerrar a sessão.
DROP POLICY IF EXISTS "Bloqueado so le o proprio perfil" ON public.profiles;
CREATE POLICY "Bloqueado so le o proprio perfil" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT (SELECT public.is_current_user_blocked()));
DROP POLICY IF EXISTS "Bloqueado nao cria perfil" ON public.profiles;
CREATE POLICY "Bloqueado nao cria perfil" ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT (SELECT public.is_current_user_blocked()));
DROP POLICY IF EXISTS "Bloqueado nao altera perfil" ON public.profiles;
CREATE POLICY "Bloqueado nao altera perfil" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (SELECT public.is_current_user_blocked()));
DROP POLICY IF EXISTS "Bloqueado sem arquivos" ON storage.objects;
CREATE POLICY "Bloqueado sem arquivos" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_current_user_blocked())) WITH CHECK (NOT (SELECT public.is_current_user_blocked()));

-- ========== 2) Inscrições em eventos ==========
CREATE OR REPLACE FUNCTION public.register_for_event(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _ev public.events; _approved int; _status text; _row public.event_registrations; _found boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Faça login para se inscrever'; END IF;
  IF public.is_user_blocked(_uid) THEN RAISE EXCEPTION 'Acesso bloqueado'; END IF;
  -- trava o evento para duas inscrições simultâneas não passarem da lotação
  SELECT * INTO _ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento indisponível'; END IF;
  SELECT * INTO _row FROM public.event_registrations WHERE event_id = _event_id AND user_id = _uid;
  _found := FOUND;
  IF _found AND _row.status NOT IN ('cancelled','rejected') THEN RETURN to_jsonb(_row); END IF;
  IF _found AND _row.status = 'rejected' THEN RAISE EXCEPTION 'Seu pedido para este evento não foi aprovado.'; END IF;
  IF _ev.status::text <> 'publicado' OR _ev.approval_status <> 'approved' THEN RAISE EXCEPTION 'Evento indisponível'; END IF;
  IF _ev.source = 'terceiros' THEN RAISE EXCEPTION 'A inscrição é feita no site do organizador.'; END IF;
  IF _ev.event_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Este evento já foi encerrado.'; END IF;
  SELECT count(*) INTO _approved FROM public.event_registrations WHERE event_id = _event_id AND status = 'approved';
  IF _ev.max_attendees IS NOT NULL AND _approved >= _ev.max_attendees THEN _status := 'waitlist';
  ELSIF _ev.requires_approval THEN _status := 'pending';
  ELSE _status := 'approved'; END IF;
  IF _found THEN
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

-- Só promove da lista de espera quando uma vaga confirmada foi realmente liberada.
CREATE OR REPLACE FUNCTION public.cancel_event_registration(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _next uuid; _ev public.events; _row public.event_registrations; _approved int;
BEGIN
  IF _uid IS NULL OR public.is_user_blocked(_uid) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO _ev FROM public.events WHERE id = _event_id FOR UPDATE;
  SELECT * INTO _row FROM public.event_registrations
    WHERE event_id = _event_id AND user_id = _uid AND checked_in_at IS NULL
      AND status IN ('pending','approved','waitlist') FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;  -- nada a cancelar (recusado continua recusado)
  UPDATE public.event_registrations SET status = 'cancelled' WHERE id = _row.id;
  IF _row.status <> 'approved' THEN RETURN; END IF;
  SELECT count(*) INTO _approved FROM public.event_registrations WHERE event_id = _event_id AND status = 'approved';
  IF _ev.max_attendees IS NOT NULL AND _approved >= _ev.max_attendees THEN RETURN; END IF;
  SELECT id INTO _next FROM public.event_registrations WHERE event_id = _event_id AND status = 'waitlist' ORDER BY created_at LIMIT 1;
  IF _next IS NOT NULL THEN
    UPDATE public.event_registrations SET status = CASE WHEN _ev.requires_approval THEN 'pending' ELSE 'approved' END WHERE id = _next;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.decide_registration(_ids uuid[], _status text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); n integer; e record; taken int; adding int;
BEGIN
  IF NOT(public.is_admin_or_super(uid) OR public.has_ambassador_permission(uid,'eventos:inscricoes')) THEN
    RAISE EXCEPTION 'Sem acesso para aprovar inscrições'; END IF;
  IF _status NOT IN ('approved','rejected','pending','waitlist') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  IF _status = 'approved' THEN
    FOR e IN SELECT id, name, max_attendees FROM public.events
             WHERE id IN (SELECT event_id FROM public.event_registrations WHERE id = ANY(_ids))
             ORDER BY id FOR UPDATE
    LOOP
      CONTINUE WHEN e.max_attendees IS NULL;
      SELECT count(*) INTO taken FROM public.event_registrations
        WHERE event_id = e.id AND status = 'approved' AND id <> ALL(_ids);
      SELECT count(*) INTO adding FROM public.event_registrations
        WHERE event_id = e.id AND id = ANY(_ids) AND status <> 'cancelled';
      IF taken + adding > e.max_attendees THEN
        RAISE EXCEPTION 'Lotação excedida: % vaga(s) livre(s) em "%". Aumente o limite ou aprove menos pessoas.',
          greatest(e.max_attendees - taken, 0), e.name;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.event_registrations SET status=_status, decided_by=uid, decided_at=now()
    WHERE id = ANY(_ids) AND checked_in_at IS NULL AND status <> 'cancelled';
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.audit_logs(user_id,user_name,action,entity,description)
    VALUES(uid, public._audit_actor_name(uid), 'decide_registration', 'event_registration', _status || ' x' || n);
  RETURN n;
END $$;

-- Sistema antigo de "interesse": o histórico fica, mas não recebe novas inscrições pela função.
REVOKE EXECUTE ON FUNCTION public.register_event_interest(uuid) FROM PUBLIC, anon, authenticated;

-- Link de transmissão: devolvido só a quem pode ver.
CREATE OR REPLACE FUNCTION public.get_event_online_link(_event_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.online_link FROM public.events e
  WHERE e.id = _event_id AND NOT coalesce(public.is_current_user_blocked(), false) AND (
    (e.source = 'terceiros' AND e.status::text = 'publicado' AND e.approval_status = 'approved')
    OR e.submitted_by = auth.uid()
    OR public.is_admin_or_super(auth.uid())
    OR public.has_ambassador_permission(auth.uid(), 'eventos')
    OR EXISTS (SELECT 1 FROM public.event_registrations r
               WHERE r.event_id = e.id AND r.user_id = auth.uid() AND r.status = 'approved')
  )
$$;
REVOKE ALL ON FUNCTION public.get_event_online_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_online_link(uuid) TO anon, authenticated;
-- get_event_online_link usa is_current_user_blocked também para visitantes.
GRANT EXECUTE ON FUNCTION public.is_current_user_blocked() TO anon;

-- ========== 3) Sorteio de rifa ==========
CREATE OR REPLACE FUNCTION public.draw_raffle(_raffle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prize record; _ticket record; _results jsonb := '[]'::jsonb; _state text;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  -- trava a rifa: um segundo sorteio simultâneo espera e encontra os prêmios já sorteados
  SELECT status INTO _state FROM public.raffles WHERE id = _raffle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rifa não encontrada'; END IF;
  IF _state NOT IN ('open','closed') THEN
    RAISE EXCEPTION 'Só é possível sortear rifas abertas ou encerradas.'; END IF;
  FOR _prize IN SELECT * FROM public.raffle_prizes
    WHERE raffle_id = _raffle_id AND winner_ticket_id IS NULL ORDER BY display_order, created_at
  LOOP
    SELECT t.* INTO _ticket FROM public.raffle_tickets t
      WHERE t.raffle_id = _raffle_id AND t.status = 'paid' AND t.is_winner = false
      ORDER BY gen_random_uuid() LIMIT 1;
    EXIT WHEN NOT FOUND;
    UPDATE public.raffle_tickets SET is_winner = true WHERE id = _ticket.id;
    UPDATE public.raffle_prizes SET winner_ticket_id = _ticket.id, drawn_at = now() WHERE id = _prize.id;
    _results := _results || jsonb_build_object('prize_id', _prize.id, 'prize_title', _prize.title,
      'ticket_id', _ticket.id, 'number', _ticket.number, 'label', _ticket.label, 'winner', _ticket.buyer_name);
  END LOOP;
  UPDATE public.raffles SET status = 'drawn' WHERE id = _raffle_id
    AND NOT EXISTS (SELECT 1 FROM public.raffle_prizes p WHERE p.raffle_id = _raffle_id AND p.winner_ticket_id IS NULL);
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description, diff)
    VALUES (auth.uid(), public._audit_actor_name(auth.uid()), 'DRAW', 'raffles', _raffle_id::text, 'Sorteio realizado', _results);
  RETURN _results;
END $$;
REVOKE EXECUTE ON FUNCTION public.draw_raffle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_raffle(uuid) TO authenticated;

-- ========== 4) Vagas e recrutador ==========
-- Candidatura recusada ou concluída não pode ser apagada para ser reenviada.
DROP POLICY IF EXISTS "Usuário cancela própria candidatura" ON public.job_applications;
CREATE POLICY "Usuário cancela própria candidatura" ON public.job_applications FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status IN ('enviada','em_analise'));

CREATE OR REPLACE FUNCTION public.guard_job_application_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (NEW.user_id <> OLD.user_id OR NEW.job_id <> OLD.job_id) THEN
    RAISE EXCEPTION 'Não é permitido alterar o candidato ou a vaga.';
  END IF;
  IF auth.uid() IS NOT NULL AND NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'A mensagem do candidato não pode ser alterada.';
  END IF;
  IF NEW.status <> OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT NEW.user_id, 'application_status', 'Sua candidatura foi atualizada',
      j.title || ': ' || CASE NEW.status WHEN 'em_analise' THEN 'Em análise' WHEN 'contratado' THEN 'Contratado'
        WHEN 'rejeitada' THEN 'Não selecionada' ELSE 'Enviada' END, '/dashboard/candidaturas'
    FROM public.jobs j WHERE j.id = NEW.job_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.can_view_candidate_contact(_target text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND NOT public.is_user_blocked(auth.uid()) AND (
    auth.uid()::text = _target
    OR public.is_admin_or_super(auth.uid())
    OR (public.is_recruiter(auth.uid())
      AND NOT EXISTS (SELECT 1 FROM public.profiles b WHERE b.user_id::text = _target AND b.is_blocked)
      AND (
        EXISTS (SELECT 1 FROM public.job_applications a JOIN public.jobs j ON j.id = a.job_id
                WHERE a.user_id::text = _target AND j.created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.candidate_profiles c ON c.user_id = p.user_id
                   WHERE p.user_id::text = _target AND p.looking_for_job AND c.share_contact)
      ))
  )
$$;

CREATE OR REPLACE FUNCTION public.get_candidate_details(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE contact boolean := public.can_view_candidate_contact(_user_id::text);
  p public.profiles; c public.candidate_profiles; account_email text;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE user_id = _user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT coalesce(contact, false) AND NOT (p.looking_for_job AND NOT p.is_blocked AND (
       public.is_recruiter(auth.uid()) OR public.has_ambassador_permission(auth.uid(), 'candidatos'))) THEN
    RAISE EXCEPTION 'Sem acesso a este candidato.';
  END IF;
  SELECT * INTO c FROM public.candidate_profiles WHERE user_id = _user_id;
  SELECT u.email INTO account_email FROM auth.users u WHERE u.id = _user_id;  -- e-mail confirmado da conta
  RETURN jsonb_build_object(
    'user_id', p.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'bio', p.bio,
    'work_area', p.work_area, 'tech_tags', p.tech_tags, 'social_links', p.social_links,
    'city', p.address_city, 'state', p.address_state, 'looking_for_job', p.looking_for_job,
    'contact_visible', coalesce(contact, false),
    'email', CASE WHEN contact THEN coalesce(account_email, p.email) END,
    'phone', CASE WHEN contact THEN p.phone END,
    'resume_path', CASE WHEN contact THEN c.resume_path END,
    'resume_name', CASE WHEN contact THEN c.resume_name END,
    'salary_expectation', CASE WHEN contact THEN c.salary_expectation END,
    'headline', c.headline, 'availability', c.availability, 'preferred_modality', c.preferred_modality,
    'education', coalesce(c.education, '[]'::jsonb), 'courses', coalesce(c.courses, '[]'::jsonb),
    'experiences', coalesce(c.experiences, '[]'::jsonb), 'languages', coalesce(c.languages, '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_job_applicants()
RETURNS TABLE (application_id uuid, job_id uuid, job_title text, company text, status text, message text,
  created_at timestamptz, user_id uuid, display_name text, avatar_url text, work_area text, tech_tags text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, j.id, j.title, j.company, a.status, a.message, a.created_at,
         p.user_id, p.display_name, p.avatar_url, p.work_area, p.tech_tags
  FROM public.job_applications a
  JOIN public.jobs j ON j.id = a.job_id
  JOIN public.profiles p ON p.user_id = a.user_id
  WHERE public.is_admin_or_super(auth.uid())
     OR (public.is_recruiter(auth.uid()) AND j.created_by = auth.uid() AND NOT p.is_blocked)
  ORDER BY a.created_at DESC
$$;

-- Banco de talentos: embaixador com a área "candidatos" também vê; bloqueados saem.
CREATE OR REPLACE FUNCTION public.get_recruiter_candidates()
RETURNS TABLE (user_id uuid, display_name text, avatar_url text, bio text, work_area text, tech_tags text[],
  looking_for_job boolean, is_verified_recruiter boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.display_name, p.avatar_url, p.bio, p.work_area, p.tech_tags, p.looking_for_job, p.is_verified_recruiter
  FROM public.profiles p
  WHERE p.looking_for_job AND NOT p.is_blocked
    AND (public.is_recruiter(auth.uid()) OR public.is_admin_or_super(auth.uid())
         OR public.has_ambassador_permission(auth.uid(), 'candidatos'))
$$;

-- Quem indicou a vaga fica sabendo da decisão.
CREATE OR REPLACE FUNCTION public.notify_job_suggestion_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status::text = 'rascunho' AND NEW.status::text IN ('publicado','arquivado')
     AND NEW.application_type = 'externa' AND NEW.created_by IS NOT NULL
     AND NEW.created_by IS DISTINCT FROM auth.uid()
     AND NOT public.can_manage_all_jobs(NEW.created_by) AND NOT public.is_recruiter(NEW.created_by) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.created_by, 'job_suggestion_decision',
      CASE WHEN NEW.status::text = 'publicado' THEN 'Sua vaga indicada foi publicada' ELSE 'Sua vaga indicada não foi aprovada' END,
      NEW.title || ' — ' || NEW.company, '/dashboard/vagas');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_job_suggestion_decision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_job_suggestion_decision ON public.jobs;
CREATE TRIGGER trg_notify_job_suggestion_decision AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_suggestion_decision();

COMMIT;
