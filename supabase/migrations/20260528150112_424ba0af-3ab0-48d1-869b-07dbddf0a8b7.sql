-- 1) Drop old project_members (replaced by squads + squad_members)
DROP POLICY IF EXISTS "Apenas super admin gerencia membros - delete" ON public.project_members;
DROP POLICY IF EXISTS "Apenas super admin gerencia membros - insert" ON public.project_members;
DROP POLICY IF EXISTS "Apenas super admin gerencia membros - update" ON public.project_members;
DROP POLICY IF EXISTS "Membros e admins veem membros do projeto" ON public.project_members;
DROP TABLE IF EXISTS public.project_members CASCADE;

-- Drop helper functions that referenced project_members
DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_project_leader(uuid, uuid) CASCADE;

-- 2) squads
CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squads TO authenticated;
GRANT ALL ON public.squads TO service_role;

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

-- 3) squad_members
CREATE TABLE public.squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_in_squad text NOT NULL DEFAULT 'MEMBRO' CHECK (role_in_squad IN ('LIDER','MEMBRO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_members TO authenticated;
GRANT ALL ON public.squad_members TO service_role;

ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- 4) Helper functions
CREATE OR REPLACE FUNCTION public.is_squad_member(_user_id uuid, _squad_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.squad_members WHERE user_id = _user_id AND squad_id = _squad_id)
$$;

CREATE OR REPLACE FUNCTION public.is_squad_leader(_user_id uuid, _squad_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.squad_members WHERE user_id = _user_id AND squad_id = _squad_id AND role_in_squad = 'LIDER')
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_members sm
    JOIN public.squads s ON s.id = sm.squad_id
    WHERE sm.user_id = _user_id AND s.project_id = _project_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_leader(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_members sm
    JOIN public.squads s ON s.id = sm.squad_id
    WHERE sm.user_id = _user_id AND s.project_id = _project_id AND sm.role_in_squad = 'LIDER'
  )
$$;

-- 5) RLS for squads
CREATE POLICY "Membros e admins veem squads"
  ON public.squads FOR SELECT
  USING (is_admin_or_super(auth.uid()) OR is_squad_member(auth.uid(), id));

CREATE POLICY "Super admin cria squads"
  ON public.squads FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN'::app_role));

CREATE POLICY "Admin ou líder de squad edita squad"
  ON public.squads FOR UPDATE
  USING (is_admin_or_super(auth.uid()) OR is_squad_leader(auth.uid(), id));

CREATE POLICY "Super admin remove squad"
  ON public.squads FOR DELETE
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role));

-- 6) RLS for squad_members
CREATE POLICY "Membros e admins veem squad_members"
  ON public.squad_members FOR SELECT
  USING (is_admin_or_super(auth.uid()) OR is_squad_member(auth.uid(), squad_id));

CREATE POLICY "Super admin gerencia squad_members - insert"
  ON public.squad_members FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN'::app_role));

CREATE POLICY "Super admin gerencia squad_members - update"
  ON public.squad_members FOR UPDATE
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role));

CREATE POLICY "Super admin gerencia squad_members - delete"
  ON public.squad_members FOR DELETE
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role));

-- 7) Tech tags em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tech_tags text[] NOT NULL DEFAULT '{}';

-- 8) job_applications (histórico de candidaturas)
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada','em_analise','contratado','rejeitada')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas candidaturas"
  ON public.job_applications FOR SELECT
  USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

CREATE POLICY "Recrutador vê candidaturas das suas vagas"
  ON public.job_applications FOR SELECT
  USING (is_recruiter(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id = job_applications.job_id AND j.created_by = auth.uid()
  ));

CREATE POLICY "Usuário cria própria candidatura"
  ON public.job_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário cancela própria candidatura"
  ON public.job_applications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Recrutador/admin atualiza status"
  ON public.job_applications FOR UPDATE
  USING (
    is_admin_or_super(auth.uid()) OR
    (is_recruiter(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_applications.job_id AND j.created_by = auth.uid()
    ))
  );

-- 9) project_posts (mural)
CREATE TABLE public.project_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_posts TO authenticated;
GRANT ALL ON public.project_posts TO service_role;

ALTER TABLE public.project_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros e admins leem mural"
  ON public.project_posts FOR SELECT
  USING (is_admin_or_super(auth.uid()) OR is_project_member(auth.uid(), project_id));

CREATE POLICY "Membros do projeto postam no mural"
  ON public.project_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (is_admin_or_super(auth.uid()) OR is_project_member(auth.uid(), project_id)));

CREATE POLICY "Autor edita próprio post"
  ON public.project_posts FOR UPDATE
  USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

CREATE POLICY "Autor ou admin remove post"
  ON public.project_posts FOR DELETE
  USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

-- 10) Triggers de updated_at
CREATE TRIGGER trg_squads_updated_at BEFORE UPDATE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_job_applications_updated_at BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_project_posts_updated_at BEFORE UPDATE ON public.project_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();