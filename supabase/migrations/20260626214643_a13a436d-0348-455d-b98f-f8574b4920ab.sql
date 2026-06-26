CREATE TABLE IF NOT EXISTS public.community_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_type text NOT NULL CHECK (profile_type IN ('ambassador', 'administrator')),
  name text NOT NULL,
  role_title text,
  photo_url text,
  professional_story text,
  community_role text,
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_profiles TO authenticated;
GRANT ALL ON public.community_profiles TO service_role;

ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active community profiles" ON public.community_profiles;
CREATE POLICY "Public can view active community profiles"
ON public.community_profiles
FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins manage community profiles" ON public.community_profiles;
CREATE POLICY "Admins manage community profiles"
ON public.community_profiles
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE IF NOT EXISTS public.member_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_feed_posts TO authenticated;
GRANT ALL ON public.member_feed_posts TO service_role;

ALTER TABLE public.member_feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read visible feed posts" ON public.member_feed_posts;
CREATE POLICY "Members can read visible feed posts"
ON public.member_feed_posts
FOR SELECT
TO authenticated
USING (status = 'published' OR author_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Members create own feed posts" ON public.member_feed_posts;
CREATE POLICY "Members create own feed posts"
ON public.member_feed_posts
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid() AND status = 'published');

DROP POLICY IF EXISTS "Members edit own feed posts" ON public.member_feed_posts;
CREATE POLICY "Members edit own feed posts"
ON public.member_feed_posts
FOR UPDATE
TO authenticated
USING (author_id = auth.uid() OR public.is_admin_or_super(auth.uid()))
WITH CHECK ((author_id = auth.uid() AND status IN ('published', 'deleted')) OR public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins delete feed posts" ON public.member_feed_posts;
CREATE POLICY "Admins delete feed posts"
ON public.member_feed_posts
FOR DELETE
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

DROP TRIGGER IF EXISTS update_community_profiles_updated_at ON public.community_profiles;
CREATE TRIGGER update_community_profiles_updated_at
BEFORE UPDATE ON public.community_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_feed_posts_updated_at ON public.member_feed_posts;
CREATE TRIGGER update_member_feed_posts_updated_at
BEFORE UPDATE ON public.member_feed_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.public_site_settings (setting_key, setting_value, description)
VALUES
  ('mascots', '{"items":[{"name":"Axolote Dev","image_url":"","placement":"home_hero","caption":"Mascote oficial da comunidade"}]}'::jsonb, 'Mascotes exibidos nas páginas públicas'),
  ('home_content', '{"ecosystem_eyebrow":"ECOSSISTEMA","ecosystem_title":"Áreas & Tecnologias","ecosystem_subtitle":"A comunidade reúne profissionais de todas as frentes da tecnologia.","jobs_eyebrow":"OPORTUNIDADES","jobs_title":"Últimas vagas","jobs_subtitle":"Vagas curadas e publicadas direto pela equipe.","events_eyebrow":"AGENDA","events_title":"Próximos eventos","events_subtitle":"Meetups, workshops e lives da comunidade.","channels_eyebrow":"ONDE A GENTE TÁ","channels_title":"Canais oficiais","channels_subtitle":"Plug-se nos canais que mais combinam com você.","cta_title":"Faça parte da maior comunidade tech","cta_description":"Aprenda, compartilhe, evolua e conquiste novas oportunidades ao lado de quem vive tecnologia todos os dias.","cta_button":"Quero entrar!"}'::jsonb, 'Textos editáveis da página inicial')
ON CONFLICT (setting_key) DO NOTHING;

UPDATE public.public_site_settings
SET setting_value = jsonb_strip_nulls(setting_value || '{"story_title":"Nossa história","story_body":"A GALERA DO T.I. nasceu para conectar pessoas que vivem tecnologia, criando um ambiente acolhedor para aprender, compartilhar experiências, montar portfólio e encontrar oportunidades reais.","hero_title":"Comunidade GALERA DO T.I.","hero_subtitle":"Se tem código, tem solução. Se não tem, a gente cria.","mission_title":"Nossa missão","values_title":"Nossos valores"}'::jsonb)
WHERE setting_key = 'about';

CREATE OR REPLACE FUNCTION public.audit_community_profiles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_name text;
  action_name text;
BEGIN
  SELECT COALESCE(display_name, full_name, email) INTO actor_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN action_name := 'COMMUNITY_PROFILE_CREATED';
  ELSIF TG_OP = 'UPDATE' THEN action_name := 'COMMUNITY_PROFILE_UPDATED';
  ELSE action_name := 'COMMUNITY_PROFILE_DELETED';
  END IF;

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (
    auth.uid(),
    actor_name,
    action_name,
    'community_profiles',
    COALESCE(NEW.id, OLD.id)::text,
    COALESCE(NEW.profile_type, OLD.profile_type) || ': ' || COALESCE(NEW.name, OLD.name)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_community_profiles_changes_trigger ON public.community_profiles;
CREATE TRIGGER audit_community_profiles_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.community_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_community_profiles_changes();

CREATE OR REPLACE FUNCTION public.audit_member_feed_posts_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_name text;
  action_name text;
BEGIN
  SELECT COALESCE(display_name, full_name, email) INTO actor_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN action_name := 'FEED_POST_CREATED';
  ELSIF TG_OP = 'UPDATE' THEN action_name := 'FEED_POST_UPDATED';
  ELSE action_name := 'FEED_POST_DELETED';
  END IF;

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (
    auth.uid(),
    actor_name,
    action_name,
    'member_feed_posts',
    COALESCE(NEW.id, OLD.id)::text,
    left(COALESCE(NEW.content, OLD.content), 160)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_member_feed_posts_changes_trigger ON public.member_feed_posts;
CREATE TRIGGER audit_member_feed_posts_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.member_feed_posts
FOR EACH ROW EXECUTE FUNCTION public.audit_member_feed_posts_changes();

GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_drop_image_upload_attempt(text, text, text, text, text, text, text, bigint) TO authenticated;

DROP POLICY IF EXISTS "Admin envia imagem de drop" ON storage.objects;
DROP POLICY IF EXISTS "Admin atualiza imagem de drop" ON storage.objects;
DROP POLICY IF EXISTS "Admin remove imagem de drop" ON storage.objects;

CREATE POLICY "Admin envia imagem de drop"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

CREATE POLICY "Admin atualiza imagem de drop"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN', 'SUPER_ADMIN')
  )
)
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

CREATE POLICY "Admin remove imagem de drop"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);