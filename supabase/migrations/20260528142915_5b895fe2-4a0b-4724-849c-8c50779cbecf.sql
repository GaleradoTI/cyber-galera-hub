
-- 1. Add RECRUTADOR to app_role enum (safe if exists)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'RECRUTADOR';

-- 2. Member badges (custom titles assigned by SUPER_ADMIN)
CREATE TABLE public.member_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'primary',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_badges_user ON public.member_badges(user_id);

GRANT SELECT ON public.member_badges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_badges TO authenticated;
GRANT ALL ON public.member_badges TO service_role;

ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges são públicas para leitura"
  ON public.member_badges FOR SELECT USING (true);

CREATE POLICY "Super admin insere badges"
  ON public.member_badges FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Super admin atualiza badges"
  ON public.member_badges FOR UPDATE
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Super admin remove badges"
  ON public.member_badges FOR DELETE
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- 3. Projects (Squads)
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_url text,
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 4. Project members
CREATE TABLE public.project_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_in_project text NOT NULL DEFAULT 'MEMBRO',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 5. Helper functions for project access (avoid recursion)
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_leader(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id AND role_in_project = 'LIDER'
  )
$$;

-- Policies for projects
CREATE POLICY "Membros e admins veem projetos"
  ON public.projects FOR SELECT
  USING (
    public.is_admin_or_super(auth.uid())
    OR public.is_project_member(auth.uid(), id)
  );

CREATE POLICY "Admins criam projetos"
  ON public.projects FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admin ou líder edita projeto"
  ON public.projects FOR UPDATE
  USING (
    public.is_admin_or_super(auth.uid())
    OR public.is_project_leader(auth.uid(), id)
  );

CREATE POLICY "Admin remove projeto"
  ON public.projects FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- Policies for project_members
CREATE POLICY "Membros e admins veem membros do projeto"
  ON public.project_members FOR SELECT
  USING (
    public.is_admin_or_super(auth.uid())
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "Apenas super admin gerencia membros - insert"
  ON public.project_members FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Apenas super admin gerencia membros - update"
  ON public.project_members FOR UPDATE
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Apenas super admin gerencia membros - delete"
  ON public.project_members FOR DELETE
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- 6. Trigger to update timestamps on projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Helper for recruiter check (using text compare so we don't need the new enum value in same tx)
CREATE OR REPLACE FUNCTION public.is_recruiter(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'RECRUTADOR'
  )
$$;

-- 8. Update jobs policies: recruiter manages own jobs
CREATE POLICY "Recrutadores criam próprias vagas"
  ON public.jobs FOR INSERT
  WITH CHECK (public.is_recruiter(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Recrutadores editam próprias vagas"
  ON public.jobs FOR UPDATE
  USING (public.is_recruiter(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Recrutadores removem próprias vagas"
  ON public.jobs FOR DELETE
  USING (public.is_recruiter(auth.uid()) AND created_by = auth.uid());

-- Recruiter can see own drafts even if not published
CREATE POLICY "Recrutador vê suas próprias vagas"
  ON public.jobs FOR SELECT
  USING (public.is_recruiter(auth.uid()) AND created_by = auth.uid());

-- 9. Allow recruiters to view profiles of members looking for job
CREATE POLICY "Recrutadores veem candidatos em busca"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_recruiter(auth.uid()) AND looking_for_job = true);
