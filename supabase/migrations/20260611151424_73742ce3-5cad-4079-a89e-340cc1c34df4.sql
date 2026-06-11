
-- 1) Restringir comunidade events para autenticados
DROP POLICY IF EXISTS "Published events are public" ON public.events;
CREATE POLICY "Public sees terceiros events"
ON public.events FOR SELECT TO public
USING (status = 'publicado' AND approval_status = 'approved' AND source = 'terceiros');

CREATE POLICY "Authenticated sees all published events"
ON public.events FOR SELECT TO authenticated
USING (status = 'publicado' AND approval_status = 'approved');

CREATE POLICY "Admins see all events"
ON public.events FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- 2) Q&A por evento
CREATE TABLE public.event_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  answer text,
  answered_by uuid,
  answered_at timestamptz,
  moderated_by uuid,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_questions TO authenticated;
GRANT ALL ON public.event_questions TO service_role;

ALTER TABLE public.event_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved questions are public"
ON public.event_questions FOR SELECT TO public
USING (status = 'approved');

CREATE POLICY "Author sees own questions"
ON public.event_questions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins see all questions"
ON public.event_questions FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Auth users ask questions"
ON public.event_questions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Author deletes own pending"
ON public.event_questions FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins moderate questions"
ON public.event_questions FOR UPDATE TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins delete questions"
ON public.event_questions FOR DELETE TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER event_questions_updated
BEFORE UPDATE ON public.event_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX event_questions_event_idx ON public.event_questions(event_id, status, created_at DESC);

-- 3) Parceiros
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text CHECK (char_length(description) <= 500),
  logo_url text,
  website_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active partners are public"
ON public.partners FOR SELECT TO public
USING (is_active = true OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins manage partners"
ON public.partners FOR ALL TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER partners_updated
BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Denúncias
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('job','event')),
  entity_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 100),
  details text CHECK (char_length(details) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed','unpublished')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users create reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Reporter sees own reports"
ON public.reports FOR SELECT TO authenticated
USING (reporter_id = auth.uid());

CREATE POLICY "Admins see all reports"
ON public.reports FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins update reports"
ON public.reports FOR UPDATE TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER reports_updated
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX reports_status_idx ON public.reports(status, created_at DESC);

-- Função para resolver denúncia com ação (notifica autor e opcionalmente despublica)
CREATE OR REPLACE FUNCTION public.resolve_report(_report_id uuid, _action text, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rep public.reports;
  _author uuid;
  _entity_name text;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  IF _action NOT IN ('resolved','dismissed','unpublished') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  SELECT * INTO _rep FROM public.reports WHERE id = _report_id;
  IF _rep.id IS NULL THEN RAISE EXCEPTION 'Denúncia não encontrada'; END IF;

  IF _rep.entity_type = 'job' THEN
    SELECT created_by, title INTO _author, _entity_name FROM public.jobs WHERE id = _rep.entity_id;
    IF _action = 'unpublished' THEN
      UPDATE public.jobs SET status = 'rascunho' WHERE id = _rep.entity_id;
    END IF;
  ELSE
    SELECT COALESCE(submitted_by, created_by), name INTO _author, _entity_name FROM public.events WHERE id = _rep.entity_id;
    IF _action = 'unpublished' THEN
      UPDATE public.events SET status = 'rascunho' WHERE id = _rep.entity_id;
    END IF;
  END IF;

  UPDATE public.reports
    SET status = _action,
        resolution_note = _note,
        resolved_by = auth.uid(),
        resolved_at = now()
    WHERE id = _report_id;

  IF _author IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (_author, 'report_resolved',
      CASE WHEN _action = 'unpublished' THEN 'Conteúdo despublicado após denúncia'
           WHEN _action = 'resolved'    THEN 'Denúncia sobre seu conteúdo foi resolvida'
           ELSE 'Denúncia sobre seu conteúdo foi avaliada' END,
      COALESCE(_entity_name, _rep.entity_id::text) || COALESCE(' — ' || _note, ''),
      CASE WHEN _rep.entity_type='job' THEN '/dashboard/vagas' ELSE '/dashboard/eventos' END);
  END IF;

  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, description)
  VALUES (auth.uid(), 'REPORT_' || upper(_action), _rep.entity_type, _rep.entity_id::text,
          'Denúncia ' || _report_id::text || ' → ' || _action || COALESCE(' (' || _note || ')',''));
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, text, text) TO authenticated;
