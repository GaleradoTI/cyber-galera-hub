-- Source field for join requests
ALTER TABLE public.project_join_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dashboard';

-- Update join request log trigger to include source
CREATE OR REPLACE FUNCTION public.log_join_request_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _project_name text;
BEGIN
  SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (NEW.user_id, public._audit_actor_name(NEW.user_id), 'JOIN_REQUEST_CREATED',
    'project_join_requests', NEW.id::text,
    'Solicitou entrada em: ' || COALESCE(_project_name, NEW.project_id::text)
    || ' (origem: ' || COALESCE(NEW.source,'dashboard') || ')');
  IF NEW.squad_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT sm.user_id, 'join_request', 'Nova solicitação de entrada',
           public._audit_actor_name(NEW.user_id) || ' quer entrar', '/dashboard/meus-projetos'
    FROM public.squad_members sm WHERE sm.squad_id = NEW.squad_id AND sm.role_in_squad = 'LIDER';
  END IF;
  RETURN NEW;
END $$;

-- Fix public_site_settings UPDATE policy with WITH CHECK
DROP POLICY IF EXISTS "Admins manage settings - update" ON public.public_site_settings;
CREATE POLICY "Admins manage settings - update" ON public.public_site_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));