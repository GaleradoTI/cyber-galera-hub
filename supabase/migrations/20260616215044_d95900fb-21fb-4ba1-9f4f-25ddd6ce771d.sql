
-- ============ STORAGE: corrige upload de banners por membros ============
CREATE POLICY "Autenticado envia banner de evento"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-covers' AND (storage.foldername(name))[1] = 'events');

CREATE POLICY "Autenticado atualiza banner de evento que enviou"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-covers' AND (storage.foldername(name))[1] = 'events' AND owner = auth.uid())
WITH CHECK (bucket_id = 'project-covers' AND (storage.foldername(name))[1] = 'events');

-- ============ SQUADS: recruiting_status ============
DO $$ BEGIN
  CREATE TYPE public.recruiting_status AS ENUM ('open','closed','waitlist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS recruiting_status public.recruiting_status NOT NULL DEFAULT 'closed';

-- ============ METAS ============
CREATE TABLE public.squad_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  order_index integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_goals TO authenticated;
GRANT ALL ON public.squad_goals TO service_role;
ALTER TABLE public.squad_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do projeto leem metas" ON public.squad_goals FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Admin gerencia metas" ON public.squad_goals FOR ALL TO authenticated
USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_squad_goals_updated BEFORE UPDATE ON public.squad_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.squad_goal_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.squad_goals(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  completed_by uuid,
  note text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, squad_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_goal_completions TO authenticated;
GRANT ALL ON public.squad_goal_completions TO service_role;
ALTER TABLE public.squad_goal_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do projeto leem conclusoes" ON public.squad_goal_completions FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid())
       OR EXISTS (SELECT 1 FROM public.squads s WHERE s.id = squad_id AND public.is_project_member(auth.uid(), s.project_id)));
CREATE POLICY "Membro do squad marca conclusao" ON public.squad_goal_completions FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.is_squad_member(auth.uid(), squad_id));
CREATE POLICY "Membro do squad remove conclusao" ON public.squad_goal_completions FOR DELETE TO authenticated
USING (public.is_admin_or_super(auth.uid()) OR public.is_squad_leader(auth.uid(), squad_id) OR completed_by = auth.uid());

-- ============ SOLICITAÇÕES DE ENTRADA ============
CREATE TABLE public.project_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  squad_id uuid REFERENCES public.squads(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','waitlist')),
  message text,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_active_join_req ON public.project_join_requests(project_id, user_id) WHERE status IN ('pending','waitlist');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_join_requests TO authenticated;
GRANT ALL ON public.project_join_requests TO service_role;
ALTER TABLE public.project_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve proprias solicitacoes" ON public.project_join_requests FOR SELECT TO authenticated
USING (user_id = auth.uid()
       OR public.is_admin_or_super(auth.uid())
       OR (squad_id IS NOT NULL AND public.is_squad_leader(auth.uid(), squad_id))
       OR public.is_project_leader(auth.uid(), project_id));
CREATE POLICY "Usuario cria propria solicitacao" ON public.project_join_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status IN ('pending','waitlist'));
CREATE POLICY "Decisor atualiza" ON public.project_join_requests FOR UPDATE TO authenticated
USING (public.is_admin_or_super(auth.uid())
       OR (squad_id IS NOT NULL AND public.is_squad_leader(auth.uid(), squad_id))
       OR public.is_project_leader(auth.uid(), project_id));

CREATE TRIGGER trg_join_req_updated BEFORE UPDATE ON public.project_join_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUNÇÃO: aprovar / rejeitar / lista de espera ============
CREATE OR REPLACE FUNCTION public.decide_join_request(_id uuid, _action text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.project_join_requests; _allowed boolean; _project_name text; _squad_name text;
BEGIN
  SELECT * INTO _req FROM public.project_join_requests WHERE id = _id;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  _allowed := public.is_admin_or_super(auth.uid())
              OR (_req.squad_id IS NOT NULL AND public.is_squad_leader(auth.uid(), _req.squad_id))
              OR public.is_project_leader(auth.uid(), _req.project_id);
  IF NOT _allowed THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _action NOT IN ('approved','rejected','waitlist') THEN RAISE EXCEPTION 'Ação inválida'; END IF;

  IF _action = 'approved' THEN
    IF _req.squad_id IS NULL THEN RAISE EXCEPTION 'Defina o squad antes de aprovar'; END IF;
    INSERT INTO public.squad_members(squad_id, user_id, role_in_squad)
    VALUES (_req.squad_id, _req.user_id, 'MEMBRO')
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.project_join_requests
    SET status = _action, decided_by = auth.uid(), decided_at = now(), decision_note = _note
    WHERE id = _id;

  SELECT name INTO _project_name FROM public.projects WHERE id = _req.project_id;
  IF _req.squad_id IS NOT NULL THEN SELECT name INTO _squad_name FROM public.squads WHERE id = _req.squad_id; END IF;

  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_req.user_id, 'join_request_' || _action,
    CASE WHEN _action='approved' THEN 'Aprovado em ' || COALESCE(_project_name,'projeto')
         WHEN _action='waitlist' THEN 'Você entrou na lista de espera'
         ELSE 'Solicitação não aceita' END,
    COALESCE(_squad_name || ' · ', '') || COALESCE(_note, ''),
    '/dashboard/meus-projetos');

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
          'JOIN_REQUEST_' || upper(_action), 'project_join_requests', _id::text,
          'Solicitação em ' || COALESCE(_project_name, _req.project_id::text) || ' → ' || _action);
END $$;

-- ============ AUDITORIA: TRIGGERS NOVOS ============

-- project_posts
CREATE OR REPLACE FUNCTION public.log_project_post_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record; _action text;
BEGIN
  _row := COALESCE(NEW, OLD);
  _action := CASE TG_OP WHEN 'INSERT' THEN 'PROJECT_POST_CREATED' ELSE 'PROJECT_POST_DELETED' END;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action, 'project_posts', _row.id::text,
    CASE WHEN TG_OP='INSERT' THEN 'Post em projeto ' || NEW.project_id::text
         ELSE 'Removeu post em projeto ' || OLD.project_id::text END);
  RETURN _row;
END $$;
CREATE TRIGGER trg_log_project_posts AFTER INSERT OR DELETE ON public.project_posts
FOR EACH ROW EXECUTE FUNCTION public.log_project_post_changes();

-- post_comments
CREATE OR REPLACE FUNCTION public.log_post_comment_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
    CASE TG_OP WHEN 'INSERT' THEN 'POST_COMMENT_CREATED' ELSE 'POST_COMMENT_DELETED' END,
    'post_comments', _row.id::text, 'Comentário em post ' || _row.post_id::text);
  RETURN _row;
END $$;
CREATE TRIGGER trg_log_post_comments AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.log_post_comment_changes();

-- squad_members
CREATE OR REPLACE FUNCTION public.log_squad_member_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record; _action text; _target text; _squad text;
BEGIN
  _row := COALESCE(NEW, OLD);
  _target := public._audit_actor_name(_row.user_id);
  SELECT name INTO _squad FROM public.squads WHERE id = _row.squad_id;
  IF TG_OP = 'INSERT' THEN _action := 'SQUAD_MEMBER_ADDED';
  ELSIF TG_OP = 'DELETE' THEN _action := 'SQUAD_MEMBER_REMOVED';
  ELSE _action := 'SQUAD_MEMBER_ROLE_CHANGED';
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action, 'squad_members', _row.id::text,
    COALESCE(_target,'usuário') || ' em ' || COALESCE(_squad, _row.squad_id::text)
    || CASE WHEN TG_OP='UPDATE' THEN ' (' || OLD.role_in_squad || '→' || NEW.role_in_squad || ')' ELSE '' END);
  RETURN _row;
END $$;
CREATE TRIGGER trg_log_squad_members AFTER INSERT OR UPDATE OR DELETE ON public.squad_members
FOR EACH ROW EXECUTE FUNCTION public.log_squad_member_changes();

-- channels
CREATE OR REPLACE FUNCTION public.log_channel_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
    CASE TG_OP WHEN 'INSERT' THEN 'CHANNEL_CREATED' WHEN 'DELETE' THEN 'CHANNEL_DELETED' ELSE 'CHANNEL_UPDATED' END,
    'channels', _row.id::text,
    CASE WHEN TG_OP='DELETE' THEN 'Removeu canal: ' || OLD.name ELSE 'Canal: ' || NEW.name END);
  RETURN _row;
END $$;
CREATE TRIGGER trg_log_channels AFTER INSERT OR UPDATE OR DELETE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.log_channel_changes();

-- faqs
CREATE OR REPLACE FUNCTION public.log_faq_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
    CASE TG_OP WHEN 'INSERT' THEN 'FAQ_CREATED' WHEN 'DELETE' THEN 'FAQ_DELETED' ELSE 'FAQ_UPDATED' END,
    'faqs', _row.id::text,
    CASE WHEN TG_OP='DELETE' THEN 'Removeu FAQ: ' || OLD.question ELSE 'FAQ: ' || NEW.question END);
  RETURN _row;
END $$;
CREATE TRIGGER trg_log_faqs AFTER INSERT OR UPDATE OR DELETE ON public.faqs
FOR EACH ROW EXECUTE FUNCTION public.log_faq_changes();

-- lgpd_consents
CREATE OR REPLACE FUNCTION public.log_lgpd_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (NEW.user_id, public._audit_actor_name(NEW.user_id), 'LGPD_CONSENT_RECORDED',
    'lgpd_consents', NEW.id::text,
    'Termos ' || NEW.terms_version || ' · Privacidade ' || NEW.privacy_policy_version
    || ' (' || COALESCE(NEW.consent_origin, 'n/a') || ')');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_lgpd AFTER INSERT ON public.lgpd_consents
FOR EACH ROW EXECUTE FUNCTION public.log_lgpd_consent();

-- squad_goals
CREATE OR REPLACE FUNCTION public.log_squad_goal_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
    CASE TG_OP WHEN 'INSERT' THEN 'SQUAD_GOAL_CREATED' WHEN 'DELETE' THEN 'SQUAD_GOAL_DELETED' ELSE 'SQUAD_GOAL_UPDATED' END,
    'squad_goals', _row.id::text,
    CASE WHEN TG_OP='DELETE' THEN 'Removeu meta: ' || OLD.title ELSE 'Meta: ' || NEW.title END);
  RETURN _row;
END $$;
CREATE TRIGGER trg_log_squad_goals AFTER INSERT OR UPDATE OR DELETE ON public.squad_goals
FOR EACH ROW EXECUTE FUNCTION public.log_squad_goal_changes();

-- squad_goal_completions
CREATE OR REPLACE FUNCTION public.log_goal_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record; _goal text;
BEGIN
  _row := COALESCE(NEW, OLD);
  SELECT title INTO _goal FROM public.squad_goals WHERE id = _row.goal_id;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
    CASE TG_OP WHEN 'INSERT' THEN 'SQUAD_GOAL_COMPLETED' ELSE 'SQUAD_GOAL_UNCOMPLETED' END,
    'squad_goal_completions', _row.id::text,
    'Meta "' || COALESCE(_goal, _row.goal_id::text) || '" squad ' || _row.squad_id::text);
  RETURN _row;
END $$;
CREATE TRIGGER trg_log_goal_completions AFTER INSERT OR DELETE ON public.squad_goal_completions
FOR EACH ROW EXECUTE FUNCTION public.log_goal_completion();

-- job_applications
CREATE OR REPLACE FUNCTION public.log_job_application() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text;
BEGIN
  SELECT title INTO _title FROM public.jobs WHERE id = NEW.job_id;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (NEW.user_id, public._audit_actor_name(NEW.user_id), 'JOB_APPLIED', 'job_applications', NEW.id::text,
    'Candidatura para: ' || COALESCE(_title, NEW.job_id::text));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_job_applications AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.log_job_application();

-- user_event_interests
CREATE OR REPLACE FUNCTION public.log_event_interest() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT name INTO _name FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (NEW.user_id, public._audit_actor_name(NEW.user_id), 'EVENT_INTEREST_REGISTERED', 'events', NEW.event_id::text,
    'Inscrição em: ' || COALESCE(_name, NEW.event_id::text));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_event_interest AFTER INSERT ON public.user_event_interests
FOR EACH ROW EXECUTE FUNCTION public.log_event_interest();

-- join requests insert log
CREATE OR REPLACE FUNCTION public.log_join_request_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _project_name text;
BEGIN
  SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (NEW.user_id, public._audit_actor_name(NEW.user_id), 'JOIN_REQUEST_CREATED',
    'project_join_requests', NEW.id::text,
    'Solicitou entrada em: ' || COALESCE(_project_name, NEW.project_id::text));
  -- notifica líderes do squad alvo (ou admins via outra trilha)
  IF NEW.squad_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT sm.user_id, 'join_request', 'Nova solicitação de entrada',
           public._audit_actor_name(NEW.user_id) || ' quer entrar', '/dashboard/meus-projetos'
    FROM public.squad_members sm WHERE sm.squad_id = NEW.squad_id AND sm.role_in_squad = 'LIDER';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_join_request_insert AFTER INSERT ON public.project_join_requests
FOR EACH ROW EXECUTE FUNCTION public.log_join_request_insert();
