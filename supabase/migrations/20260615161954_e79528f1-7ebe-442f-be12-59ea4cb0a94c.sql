
-- Helper: nome de exibição do autor
CREATE OR REPLACE FUNCTION public._audit_actor_name(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(display_name, email, 'sistema') FROM public.profiles WHERE user_id = _uid LIMIT 1;
$$;

-- ============ JOBS ============
CREATE OR REPLACE FUNCTION public.log_job_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _action text; _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  _name := public._audit_actor_name(auth.uid());
  IF TG_OP = 'INSERT' THEN _action := 'JOB_CREATED';
  ELSIF TG_OP = 'DELETE' THEN _action := 'JOB_DELETED';
  ELSE _action := 'JOB_UPDATED';
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), _name, _action, 'jobs', _row.id::text,
          CASE WHEN TG_OP='DELETE' THEN 'Removeu vaga: '||OLD.title
               WHEN TG_OP='INSERT' THEN 'Criou vaga: '||NEW.title
               ELSE 'Atualizou vaga: '||NEW.title END);
  RETURN _row;
END $$;
DROP TRIGGER IF EXISTS trg_log_jobs ON public.jobs;
CREATE TRIGGER trg_log_jobs AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_job_changes();

-- ============ PARTNERS ============
CREATE OR REPLACE FUNCTION public.log_partner_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _action text; _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  _name := public._audit_actor_name(auth.uid());
  IF TG_OP = 'INSERT' THEN _action := 'PARTNER_CREATED';
  ELSIF TG_OP = 'DELETE' THEN _action := 'PARTNER_DELETED';
  ELSE _action := 'PARTNER_UPDATED';
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), _name, _action, 'partners', _row.id::text,
          CASE WHEN TG_OP='DELETE' THEN 'Removeu parceiro: '||OLD.name
               WHEN TG_OP='INSERT' THEN 'Adicionou parceiro: '||NEW.name
               ELSE 'Atualizou parceiro: '||NEW.name END);
  RETURN _row;
END $$;
DROP TRIGGER IF EXISTS trg_log_partners ON public.partners;
CREATE TRIGGER trg_log_partners AFTER INSERT OR UPDATE OR DELETE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.log_partner_changes();

-- ============ PROJECTS ============
CREATE OR REPLACE FUNCTION public.log_project_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _action text; _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  _name := public._audit_actor_name(auth.uid());
  IF TG_OP = 'INSERT' THEN _action := 'PROJECT_CREATED';
  ELSIF TG_OP = 'DELETE' THEN _action := 'PROJECT_DELETED';
  ELSE _action := 'PROJECT_UPDATED';
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), _name, _action, 'projects', _row.id::text,
          CASE WHEN TG_OP='DELETE' THEN 'Removeu projeto: '||OLD.name
               WHEN TG_OP='INSERT' THEN 'Criou projeto: '||NEW.name
               ELSE 'Atualizou projeto: '||NEW.name END);
  RETURN _row;
END $$;
DROP TRIGGER IF EXISTS trg_log_projects ON public.projects;
CREATE TRIGGER trg_log_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_changes();

-- ============ SQUADS ============
CREATE OR REPLACE FUNCTION public.log_squad_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _action text; _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  _name := public._audit_actor_name(auth.uid());
  IF TG_OP = 'INSERT' THEN _action := 'SQUAD_CREATED';
  ELSIF TG_OP = 'DELETE' THEN _action := 'SQUAD_DELETED';
  ELSE _action := 'SQUAD_UPDATED';
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), _name, _action, 'squads', _row.id::text,
          CASE WHEN TG_OP='DELETE' THEN 'Removeu squad: '||OLD.name
               WHEN TG_OP='INSERT' THEN 'Criou squad: '||NEW.name
               ELSE 'Atualizou squad: '||NEW.name END);
  RETURN _row;
END $$;
DROP TRIGGER IF EXISTS trg_log_squads ON public.squads;
CREATE TRIGGER trg_log_squads AFTER INSERT OR UPDATE OR DELETE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.log_squad_changes();

-- ============ TESTIMONIALS (moderação) ============
CREATE OR REPLACE FUNCTION public.log_testimonial_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _action text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    _name := public._audit_actor_name(auth.uid());
    _action := CASE WHEN NEW.status='approved' THEN 'TESTIMONIAL_APPROVED' ELSE 'TESTIMONIAL_REJECTED' END;
    INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
    VALUES (auth.uid(), _name, _action, 'testimonials', NEW.id::text,
            'Depoimento moderado (' || NEW.status || ')');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_testimonials ON public.testimonials;
CREATE TRIGGER trg_log_testimonials AFTER UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.log_testimonial_moderation();

-- ============ USER ROLES (promoção/rebaixamento) ============
CREATE OR REPLACE FUNCTION public.log_user_role_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor text; _target text; _row record;
BEGIN
  _row := COALESCE(NEW, OLD);
  _actor := public._audit_actor_name(auth.uid());
  _target := public._audit_actor_name(_row.user_id);
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), _actor,
          CASE WHEN TG_OP='INSERT' THEN 'ROLE_GRANTED' ELSE 'ROLE_REVOKED' END,
          'user_roles', _row.user_id::text,
          (CASE WHEN TG_OP='INSERT' THEN 'Concedeu papel ' ELSE 'Removeu papel ' END)
          || _row.role::text || ' para ' || COALESCE(_target,'usuário'));
  RETURN _row;
END $$;
DROP TRIGGER IF EXISTS trg_log_user_roles ON public.user_roles;
CREATE TRIGGER trg_log_user_roles AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_role_changes();
