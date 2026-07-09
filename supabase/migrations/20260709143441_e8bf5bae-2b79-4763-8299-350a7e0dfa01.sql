
ALTER TABLE public.member_feed_posts
  ADD COLUMN IF NOT EXISTS reposted_from_id uuid REFERENCES public.member_feed_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS pinned_until timestamptz,
  ADD COLUMN IF NOT EXISTS cover_url text;

DO $$ BEGIN
  ALTER TABLE public.member_feed_posts
    ADD CONSTRAINT member_feed_posts_kind_check CHECK (kind IN ('user','news','repost'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.member_feed_posts
    ADD CONSTRAINT member_feed_posts_news_title_check
    CHECK (kind <> 'news' OR (title IS NOT NULL AND char_length(title) BETWEEN 2 AND 160));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_member_feed_posts_reposted_from ON public.member_feed_posts(reposted_from_id);
CREATE INDEX IF NOT EXISTS idx_member_feed_posts_kind_pinned ON public.member_feed_posts(kind, pinned_until DESC NULLS LAST);

DROP POLICY IF EXISTS "Only admins create news" ON public.member_feed_posts;
CREATE POLICY "Only admins create news" ON public.member_feed_posts
FOR INSERT TO authenticated
WITH CHECK (kind <> 'news' OR public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Only admins edit news" ON public.member_feed_posts;
CREATE POLICY "Only admins edit news" ON public.member_feed_posts
FOR UPDATE TO authenticated
USING (kind <> 'news' OR public.is_admin_or_super(auth.uid()))
WITH CHECK (kind <> 'news' OR public.is_admin_or_super(auth.uid()));

-- user_follows -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id  uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT ALL ON public.user_follows TO service_role;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read follows" ON public.user_follows;
CREATE POLICY "Authenticated read follows" ON public.user_follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users follow as self" ON public.user_follows;
CREATE POLICY "Users follow as self" ON public.user_follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS "Users unfollow as self" ON public.user_follows;
CREATE POLICY "Users unfollow as self" ON public.user_follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);

CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE follower_name text;
BEGIN
  SELECT COALESCE(display_name, email, 'Alguém') INTO follower_name
  FROM public.profiles WHERE user_id = NEW.follower_id LIMIT 1;
  BEGIN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (NEW.following_id, 'follow', 'Novo seguidor',
            follower_name || ' começou a te seguir', '/dashboard/comunidade-perfis');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_follower ON public.user_follows;
CREATE TRIGGER trg_notify_new_follower AFTER INSERT ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();

CREATE OR REPLACE FUNCTION public.audit_user_follows_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_name text; action_name text;
BEGIN
  SELECT COALESCE(display_name, email) INTO actor_name
  FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  action_name := CASE TG_OP WHEN 'INSERT' THEN 'FOLLOW_CREATED' ELSE 'FOLLOW_DELETED' END;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), actor_name, action_name, 'user_follows',
          COALESCE(NEW.following_id, OLD.following_id)::text,
          'Follow ' || action_name);
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_user_follows ON public.user_follows;
CREATE TRIGGER trg_audit_user_follows AFTER INSERT OR DELETE ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION public.audit_user_follows_changes();

-- project_task_links -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
  url text NOT NULL CHECK (char_length(url) BETWEEN 4 AND 500),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_links TO authenticated;
GRANT ALL ON public.project_task_links TO service_role;
ALTER TABLE public.project_task_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members read task links" ON public.project_task_links;
CREATE POLICY "Project members read task links" ON public.project_task_links
FOR SELECT TO authenticated
USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Project members add task links" ON public.project_task_links;
CREATE POLICY "Project members add task links" ON public.project_task_links
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Author edits own task link" ON public.project_task_links;
CREATE POLICY "Author edits own task link" ON public.project_task_links
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Author or lead deletes task link" ON public.project_task_links;
CREATE POLICY "Author or lead deletes task link" ON public.project_task_links
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin_or_super(auth.uid())
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
);

DROP TRIGGER IF EXISTS update_project_task_links_updated_at ON public.project_task_links;
CREATE TRIGGER update_project_task_links_updated_at BEFORE UPDATE ON public.project_task_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_project_lead_new_task_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lead_id uuid; author_name text; project_name text;
BEGIN
  SELECT created_by, name INTO lead_id, project_name
  FROM public.projects WHERE id = NEW.project_id;
  IF lead_id IS NULL OR lead_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, email, 'Membro') INTO author_name
  FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  BEGIN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (lead_id, 'project_delivery', 'Nova entrega no projeto',
            author_name || ' entregou "' || NEW.title || '" em ' || COALESCE(project_name,'seu projeto'),
            '/dashboard/meus-projetos');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_project_lead_task_link ON public.project_task_links;
CREATE TRIGGER trg_notify_project_lead_task_link AFTER INSERT ON public.project_task_links
FOR EACH ROW EXECUTE FUNCTION public.notify_project_lead_new_task_link();

CREATE OR REPLACE FUNCTION public.audit_project_task_links_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_name text; action_name text;
BEGIN
  SELECT COALESCE(display_name, email) INTO actor_name
  FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  action_name := CASE TG_OP
    WHEN 'INSERT' THEN 'TASK_LINK_CREATED'
    WHEN 'UPDATE' THEN 'TASK_LINK_UPDATED'
    ELSE 'TASK_LINK_DELETED' END;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), actor_name, action_name, 'project_task_links',
          COALESCE(NEW.id, OLD.id)::text,
          'Entrega: ' || COALESCE(NEW.title, OLD.title));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_project_task_links ON public.project_task_links;
CREATE TRIGGER trg_audit_project_task_links
AFTER INSERT OR UPDATE OR DELETE ON public.project_task_links
FOR EACH ROW EXECUTE FUNCTION public.audit_project_task_links_changes();
