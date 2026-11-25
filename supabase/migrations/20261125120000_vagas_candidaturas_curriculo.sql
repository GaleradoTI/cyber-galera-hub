-- Vagas internas x externas, currículo do candidato e visão do recrutador.
BEGIN;

-- ========== 1) Tipo da vaga ==========
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS application_type text NOT NULL DEFAULT 'externa'
  CHECK (application_type IN ('interna','externa'));

-- Vagas já existentes: de recrutador ou sem link viram internas (o link antigo é preservado).
UPDATE public.jobs j SET application_type = 'interna'
WHERE coalesce(btrim(j.apply_url),'') = ''
   OR (public.is_recruiter(j.created_by) AND NOT public.is_admin_or_super(j.created_by));

CREATE OR REPLACE FUNCTION public.can_manage_all_jobs(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_super(_uid)
      OR public.has_ambassador_permission(_uid, 'vagas:criar')
      OR public.has_ambassador_permission(_uid, 'vagas:editar')
      OR public.has_ambassador_permission(_uid, 'vagas:publicar')
$$;

-- Recrutador = sempre interna. Membro = sempre externa, com link, e passa por aprovação.
CREATE OR REPLACE FUNCTION public.enforce_job_application_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN  -- integrações (service role)
    IF coalesce(btrim(NEW.apply_url),'') = '' THEN NEW.application_type := 'interna'; END IF;
    RETURN NEW;
  END IF;

  IF NOT public.can_manage_all_jobs(uid) THEN
    IF TG_OP = 'UPDATE' AND OLD.created_by IS DISTINCT FROM uid THEN RETURN NEW; END IF;
    NEW.created_by := uid;
    IF public.is_recruiter(uid) THEN
      NEW.application_type := 'interna';
    ELSE
      NEW.application_type := 'externa';
      NEW.status := 'rascunho';
      NEW.send_to_bot := false;
    END IF;
  END IF;

  IF NEW.application_type = 'interna' THEN
    NEW.apply_url := NULL;
  ELSIF coalesce(btrim(NEW.apply_url),'') !~* '^(https?://|mailto:)' THEN
    RAISE EXCEPTION 'Vaga externa precisa de um link de candidatura (https:// ou mailto:).';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS a_enforce_job_application_type ON public.jobs;
CREATE TRIGGER a_enforce_job_application_type
  BEFORE INSERT OR UPDATE OF application_type, apply_url, title, company, description, created_by ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_application_type();

-- Membro não pode mudar o status da própria indicação (a policy abaixo exige rascunho).
DROP POLICY IF EXISTS "Membro indica vaga externa" ON public.jobs;
CREATE POLICY "Membro indica vaga externa" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND status = 'rascunho' AND application_type = 'externa'
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_blocked));
DROP POLICY IF EXISTS "Membro ve suas indicacoes" ON public.jobs;
CREATE POLICY "Membro ve suas indicacoes" ON public.jobs FOR SELECT TO authenticated
  USING (created_by = auth.uid());
DROP POLICY IF EXISTS "Membro edita indicacao pendente" ON public.jobs;
CREATE POLICY "Membro edita indicacao pendente" ON public.jobs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status = 'rascunho' AND application_type = 'externa')
  WITH CHECK (created_by = auth.uid() AND status = 'rascunho' AND application_type = 'externa');
DROP POLICY IF EXISTS "Membro remove indicacao pendente" ON public.jobs;
CREATE POLICY "Membro remove indicacao pendente" ON public.jobs FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND status = 'rascunho' AND application_type = 'externa');

CREATE OR REPLACE FUNCTION public.notify_job_suggestion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rascunho' AND NEW.application_type = 'externa' AND NEW.created_by IS NOT NULL
     AND NOT public.can_manage_all_jobs(NEW.created_by) AND NOT public.is_recruiter(NEW.created_by) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT DISTINCT r.user_id, 'job_suggestion', 'Vaga indicada aguardando aprovação', NEW.title || ' — ' || NEW.company, '/dashboard/vagas'
    FROM public.user_roles r WHERE r.role::text IN ('ADMIN','SUPER_ADMIN');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_job_suggestion ON public.jobs;
CREATE TRIGGER trg_notify_job_suggestion AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_suggestion();

-- ========== 2) Currículo (tabela separada: dado pessoal, acesso restrito) ==========
CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text CHECK (char_length(headline) <= 160),
  education jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(education) = 'array'),
  courses jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(courses) = 'array'),
  experiences jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(experiences) = 'array'),
  languages jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(languages) = 'array'),
  availability text,
  preferred_modality text,
  salary_expectation text,
  resume_path text,
  resume_name text,
  share_contact boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (resume_path IS NULL OR resume_path LIKE user_id::text || '/%')
);
REVOKE ALL ON public.candidate_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_profiles TO authenticated;
GRANT ALL ON public.candidate_profiles TO service_role;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dono gerencia curriculo" ON public.candidate_profiles;
CREATE POLICY "Dono gerencia curriculo" ON public.candidate_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_candidate_profiles_updated ON public.candidate_profiles;
CREATE TRIGGER trg_candidate_profiles_updated BEFORE UPDATE ON public.candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 3) Quem pode ver o quê ==========
-- Contato e currículo: o próprio, admin, recrutador que recebeu candidatura,
-- ou recrutador quando a pessoa está em busca E autorizou o contato.
CREATE OR REPLACE FUNCTION public.can_view_candidate_contact(_target text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid()::text = _target
    OR public.is_admin_or_super(auth.uid())
    OR (public.is_recruiter(auth.uid()) AND (
      EXISTS (SELECT 1 FROM public.job_applications a JOIN public.jobs j ON j.id = a.job_id
              WHERE a.user_id::text = _target AND j.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.candidate_profiles c ON c.user_id = p.user_id
                 WHERE p.user_id::text = _target AND p.looking_for_job AND c.share_contact)
    ))
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_candidate_contact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_candidate_contact(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_candidate_details(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE contact boolean := public.can_view_candidate_contact(_user_id::text);
  p public.profiles; c public.candidate_profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE user_id = _user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT coalesce(contact, false) AND NOT (p.looking_for_job AND (
       public.is_recruiter(auth.uid()) OR public.has_ambassador_permission(auth.uid(), 'candidatos'))) THEN
    RAISE EXCEPTION 'Sem acesso a este candidato.';
  END IF;
  SELECT * INTO c FROM public.candidate_profiles WHERE user_id = _user_id;
  RETURN jsonb_build_object(
    'user_id', p.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'bio', p.bio,
    'work_area', p.work_area, 'tech_tags', p.tech_tags, 'social_links', p.social_links,
    'city', p.address_city, 'state', p.address_state, 'looking_for_job', p.looking_for_job,
    'contact_visible', coalesce(contact, false),
    'email', CASE WHEN contact THEN p.email END,
    'phone', CASE WHEN contact THEN p.phone END,
    'resume_path', CASE WHEN contact THEN c.resume_path END,
    'resume_name', CASE WHEN contact THEN c.resume_name END,
    'salary_expectation', CASE WHEN contact THEN c.salary_expectation END,
    'headline', c.headline, 'availability', c.availability, 'preferred_modality', c.preferred_modality,
    'education', coalesce(c.education, '[]'::jsonb), 'courses', coalesce(c.courses, '[]'::jsonb),
    'experiences', coalesce(c.experiences, '[]'::jsonb), 'languages', coalesce(c.languages, '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.get_candidate_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_candidate_details(uuid) TO authenticated;

-- Candidaturas recebidas: recrutador vê as das próprias vagas; admin vê todas.
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
     OR (public.is_recruiter(auth.uid()) AND j.created_by = auth.uid())
  ORDER BY a.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.get_job_applicants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_applicants() TO authenticated;

-- ========== 4) Regras para se candidatar ==========
CREATE OR REPLACE FUNCTION public.missing_application_fields(_uid uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN coalesce(btrim(p.display_name),'') = '' THEN 'nome' END,
    CASE WHEN coalesce(btrim(p.phone),'') = '' THEN 'telefone' END,
    CASE WHEN coalesce(btrim(p.work_area),'') = '' THEN 'area' END,
    CASE WHEN coalesce(btrim(p.address_city),'') = '' OR coalesce(btrim(p.address_state),'') = '' THEN 'cidade' END,
    -- currículo anexado dispensa preencher formação e conhecimentos
    CASE WHEN c.resume_path IS NULL AND coalesce(jsonb_array_length(c.education),0) = 0 THEN 'formacao' END,
    CASE WHEN c.resume_path IS NULL AND coalesce(cardinality(p.tech_tags),0) = 0 THEN 'conhecimentos' END
  ], NULL)
  FROM public.profiles p LEFT JOIN public.candidate_profiles c ON c.user_id = p.user_id
  WHERE p.user_id = _uid
$$;
REVOKE ALL ON FUNCTION public.missing_application_fields(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_missing_application_fields()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.missing_application_fields(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.my_missing_application_fields() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_missing_application_fields() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_job_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.jobs; missing text[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO j FROM public.jobs WHERE id = NEW.job_id;
  IF j.status::text <> 'publicado' THEN RAISE EXCEPTION 'Esta vaga não está aberta.'; END IF;
  IF j.application_type <> 'interna' THEN RAISE EXCEPTION 'Vaga externa: candidate-se pelo link da vaga.'; END IF;
  IF j.created_by = NEW.user_id THEN RAISE EXCEPTION 'Você não pode se candidatar à própria vaga.'; END IF;
  missing := public.missing_application_fields(NEW.user_id);
  IF missing IS NULL OR cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'Complete seu currículo antes de se candidatar.';
  END IF;
  NEW.status := 'enviada';
  NEW.message := left(NEW.message, 1000);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_guard_job_application ON public.job_applications;
CREATE TRIGGER a_guard_job_application BEFORE INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_application();

-- Quem muda o status não pode trocar a pessoa nem a vaga (isso liberaria dados de terceiros).
CREATE OR REPLACE FUNCTION public.guard_job_application_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (NEW.user_id <> OLD.user_id OR NEW.job_id <> OLD.job_id) THEN
    RAISE EXCEPTION 'Não é permitido alterar o candidato ou a vaga.';
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
DROP TRIGGER IF EXISTS trg_guard_job_application_update ON public.job_applications;
CREATE TRIGGER trg_guard_job_application_update BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_application_update();

-- ========== 5) Arquivos de currículo (bucket privado) ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 5242880, ARRAY['application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Curriculo envio pelo dono" ON storage.objects;
CREATE POLICY "Curriculo envio pelo dono" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Curriculo remocao pelo dono" ON storage.objects;
CREATE POLICY "Curriculo remocao pelo dono" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Curriculo leitura autorizada" ON storage.objects;
CREATE POLICY "Curriculo leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.can_view_candidate_contact((storage.foldername(name))[1]));

-- Funções de gatilho/apoio não precisam ser chamáveis pela API.
REVOKE EXECUTE ON FUNCTION public.enforce_job_application_type() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_job_suggestion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_job_application() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_job_application_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_all_jobs(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
