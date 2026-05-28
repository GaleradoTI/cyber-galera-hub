-- ============ profiles: verified recruiter ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified_recruiter boolean NOT NULL DEFAULT false;

-- Only super_admin can change is_verified_recruiter (existing "Users update own profile" with check prevents that field bypass via separate policy; we add explicit super-admin update policy already exists via "Admins update any profile". To restrict regular users from flipping it, add a trigger.)
CREATE OR REPLACE FUNCTION public.guard_verified_recruiter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_verified_recruiter IS DISTINCT FROM OLD.is_verified_recruiter
     AND NOT has_role(auth.uid(), 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Apenas SUPER_ADMIN pode alterar verificação de recrutador';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_guard_verified ON public.profiles;
CREATE TRIGGER profiles_guard_verified BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_verified_recruiter();

-- ============ projects: public + tech_stack ============
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tech_stack text[] NOT NULL DEFAULT '{}';

-- Allow anon/authenticated to read public projects (in addition to members/admins)
CREATE POLICY "Projetos públicos são visíveis"
ON public.projects FOR SELECT
USING (is_public = true);

GRANT SELECT ON public.projects TO anon;
GRANT SELECT ON public.squads TO anon;
GRANT SELECT ON public.squad_members TO anon;
GRANT SELECT ON public.profiles TO anon;

-- For squads/members of public projects to be visible publicly, add a policy
CREATE POLICY "Squads de projetos públicos são visíveis"
ON public.squads FOR SELECT
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = squads.project_id AND p.is_public = true));

CREATE POLICY "Membros de squads de projetos públicos são visíveis"
ON public.squad_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.squads s
  JOIN public.projects p ON p.id = s.project_id
  WHERE s.id = squad_members.squad_id AND p.is_public = true
));

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas notificações"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

CREATE POLICY "Usuário atualiza suas notificações"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuário remove suas notificações"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Inserts only via service_role (server fn). No INSERT policy for authenticated.

-- ============ direct_messages ============
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dm_recipient ON public.direct_messages(recipient_id, created_at DESC);
CREATE INDEX idx_dm_sender ON public.direct_messages(sender_id, created_at DESC);
CREATE INDEX idx_dm_pair ON public.direct_messages(LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes leem mensagens"
ON public.direct_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Remetente envia mensagem"
ON public.direct_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Destinatário marca como lida"
ON public.direct_messages FOR UPDATE
USING (auth.uid() = recipient_id);

CREATE POLICY "Remetente apaga própria mensagem"
ON public.direct_messages FOR DELETE
USING (auth.uid() = sender_id);

-- ============ post_comments ============
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.project_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do projeto leem comentários"
ON public.post_comments FOR SELECT
USING (
  is_admin_or_super(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.project_posts pp
    WHERE pp.id = post_comments.post_id AND is_project_member(auth.uid(), pp.project_id)
  )
);

CREATE POLICY "Membros do projeto comentam"
ON public.post_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    is_admin_or_super(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.project_posts pp
      WHERE pp.id = post_comments.post_id AND is_project_member(auth.uid(), pp.project_id)
    )
  )
);

CREATE POLICY "Autor edita comentário"
ON public.post_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Autor ou admin remove comentário"
ON public.post_comments FOR DELETE
USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

-- ============ post_reactions ============
CREATE TABLE public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.project_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);
CREATE INDEX idx_post_reactions_post ON public.post_reactions(post_id);

GRANT SELECT, INSERT, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do projeto veem reações"
ON public.post_reactions FOR SELECT
USING (
  is_admin_or_super(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.project_posts pp
    WHERE pp.id = post_reactions.post_id AND is_project_member(auth.uid(), pp.project_id)
  )
);

CREATE POLICY "Membros do projeto reagem"
ON public.post_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    is_admin_or_super(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.project_posts pp
      WHERE pp.id = post_reactions.post_id AND is_project_member(auth.uid(), pp.project_id)
    )
  )
);

CREATE POLICY "Autor remove própria reação"
ON public.post_reactions FOR DELETE
USING (auth.uid() = user_id);

-- ============ Storage buckets ============
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('project-covers', 'project-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars: anyone reads, user uploads/updates/deletes own folder
CREATE POLICY "Avatars são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Usuário envia próprio avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuário atualiza próprio avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuário remove próprio avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Project covers: anyone reads, only admin/super uploads
CREATE POLICY "Capas de projeto são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-covers');

CREATE POLICY "Admin envia capa de projeto"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-covers' AND is_admin_or_super(auth.uid()));

CREATE POLICY "Admin atualiza capa de projeto"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-covers' AND is_admin_or_super(auth.uid()));

CREATE POLICY "Admin remove capa de projeto"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-covers' AND is_admin_or_super(auth.uid()));
