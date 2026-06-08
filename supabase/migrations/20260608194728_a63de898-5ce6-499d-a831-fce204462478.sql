
-- Auto-log new user signups + site settings changes into audit_logs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, newsletter_opt_in)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'newsletter_opt_in')::boolean, false)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'MEMBRO');
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'USER_CREATED',
    'auth.users',
    NEW.id::text,
    'Novo usuário cadastrado: ' || NEW.email
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_project_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
  _action text;
  _entity_id text;
  _desc text;
BEGIN
  SELECT display_name INTO _name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF TG_OP = 'INSERT' THEN
    _action := 'PROJECT_CREATED';
    _entity_id := NEW.id::text;
    _desc := 'Projeto criado: ' || NEW.name;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'PROJECT_UPDATED';
    _entity_id := NEW.id::text;
    _desc := 'Projeto atualizado: ' || NEW.name;
  ELSE
    _action := 'PROJECT_DELETED';
    _entity_id := OLD.id::text;
    _desc := 'Projeto removido: ' || OLD.name;
  END IF;
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), _name, _action, 'projects', _entity_id, _desc);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_project_change ON public.projects;
CREATE TRIGGER trg_log_project_change
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_change();

CREATE OR REPLACE FUNCTION public.log_site_setting_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
BEGIN
  IF OLD.setting_value IS DISTINCT FROM NEW.setting_value THEN
    SELECT display_name INTO _name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
    VALUES (auth.uid(), _name, 'SETTING_UPDATED', 'public_site_settings', NEW.setting_key, 'Configuração alterada: ' || NEW.setting_key);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_site_setting_change ON public.public_site_settings;
CREATE TRIGGER trg_log_site_setting_change
AFTER UPDATE ON public.public_site_settings
FOR EACH ROW EXECUTE FUNCTION public.log_site_setting_change();
