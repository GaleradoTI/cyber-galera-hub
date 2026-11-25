-- O status de vaga usa content_status (rascunho, publicado, pausado, encerrado).
-- Recusar uma indicação = encerrar; antes o aviso esperava "arquivado" e nunca disparava.
CREATE OR REPLACE FUNCTION public.notify_job_suggestion_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status::text = 'rascunho' AND NEW.status::text IN ('publicado','encerrado')
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
