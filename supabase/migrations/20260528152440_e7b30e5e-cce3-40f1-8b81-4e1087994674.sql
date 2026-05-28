-- Notification on new job application -> notify job owner
CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid;
  _title text;
BEGIN
  SELECT created_by, title INTO _owner, _title FROM public.jobs WHERE id = NEW.job_id;
  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (_owner, 'application', 'Nova candidatura', 'Recebida para: ' || COALESCE(_title, 'sua vaga'), '/dashboard/candidatos');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_new_application ON public.job_applications;
CREATE TRIGGER trg_notify_new_application AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_new_application();

-- Squad leader assignment
CREATE OR REPLACE FUNCTION public.notify_squad_leader()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _squad_name text;
BEGIN
  IF NEW.role_in_squad = 'LIDER' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role_in_squad <> 'LIDER')) THEN
    SELECT name INTO _squad_name FROM public.squads WHERE id = NEW.squad_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'squad_leader', 'Você é líder de um squad', 'Squad: ' || COALESCE(_squad_name, ''), '/dashboard/meus-projetos');
  ELSIF NEW.role_in_squad = 'MEMBRO' AND TG_OP = 'INSERT' THEN
    SELECT name INTO _squad_name FROM public.squads WHERE id = NEW.squad_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'squad_member', 'Você foi adicionado a um squad', 'Squad: ' || COALESCE(_squad_name, ''), '/dashboard/meus-projetos');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_squad_leader ON public.squad_members;
CREATE TRIGGER trg_notify_squad_leader AFTER INSERT OR UPDATE ON public.squad_members
FOR EACH ROW EXECUTE FUNCTION public.notify_squad_leader();

-- New post on project mural -> notify other members of the project
CREATE OR REPLACE FUNCTION public.notify_project_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _project_name text;
BEGIN
  SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT sm.user_id, 'project_post', 'Novo post em ' || COALESCE(_project_name, 'um projeto'),
         LEFT(NEW.content, 120), '/dashboard/meus-projetos'
  FROM public.squad_members sm
  JOIN public.squads s ON s.id = sm.squad_id
  WHERE s.project_id = NEW.project_id AND sm.user_id <> NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_project_post ON public.project_posts;
CREATE TRIGGER trg_notify_project_post AFTER INSERT ON public.project_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_project_post();

-- DM -> notify recipient
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sender_name text;
BEGIN
  SELECT display_name INTO _sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.recipient_id, 'dm', 'Nova mensagem de ' || COALESCE(_sender_name, 'alguém'), LEFT(NEW.content, 120), '/dashboard/mensagens');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_dm ON public.direct_messages;
CREATE TRIGGER trg_notify_dm AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message();
