-- =========================================================
-- 1) DEPOIMENTOS: empresa + listagem pública com autor
-- =========================================================
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS company text;

CREATE OR REPLACE VIEW public.public_testimonials AS
SELECT
  t.id,
  t.user_id,
  t.rating,
  t.content,
  t.role_title,
  t.company,
  t.created_at,
  p.display_name  AS author_name,
  p.avatar_url    AS author_avatar_url,
  p.work_area     AS author_work_area
FROM public.testimonials t
LEFT JOIN public.profiles p ON p.user_id = t.user_id
WHERE t.status = 'approved';

ALTER VIEW public.public_testimonials SET (security_invoker = false);
REVOKE ALL ON public.public_testimonials FROM PUBLIC;
GRANT SELECT ON public.public_testimonials TO anon, authenticated, service_role;

-- =========================================================
-- 2) FEED: curtidas próprias do feed
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feed_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.member_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '👍',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_post_reactions TO authenticated;
GRANT ALL ON public.feed_post_reactions TO service_role;
ALTER TABLE public.feed_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem reações do feed"
  ON public.feed_post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Membros reagem no feed"
  ON public.feed_post_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Autor troca própria reação"
  ON public.feed_post_reactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Autor ou admin remove reação do feed"
  ON public.feed_post_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS feed_post_reactions_post_idx ON public.feed_post_reactions(post_id);

-- =========================================================
-- 3) FEED: comentários próprios do feed
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feed_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.member_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_post_comments TO authenticated;
GRANT ALL ON public.feed_post_comments TO service_role;
ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros leem comentários do feed"
  ON public.feed_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Membros comentam no feed"
  ON public.feed_post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND length(btrim(content)) > 0);
CREATE POLICY "Autor edita próprio comentário do feed"
  ON public.feed_post_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Autor ou admin remove comentário do feed"
  ON public.feed_post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS feed_post_comments_post_idx ON public.feed_post_comments(post_id, created_at);

CREATE TRIGGER trg_feed_post_comments_updated_at
  BEFORE UPDATE ON public.feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4) Notificações de curtida / comentário no feed
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_feed_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _author uuid; _name text;
BEGIN
  SELECT author_id INTO _author FROM public.member_feed_posts WHERE id = NEW.post_id;
  IF _author IS NULL OR _author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT display_name INTO _name FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_author, 'feed_comment', 'Novo comentário no seu post',
          coalesce(_name, 'Alguém') || ' comentou: ' || left(NEW.content, 120), '/dashboard/feed');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_feed_post_comment
  AFTER INSERT ON public.feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_feed_post_comment();

CREATE OR REPLACE FUNCTION public.notify_feed_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _author uuid; _name text;
BEGIN
  SELECT author_id INTO _author FROM public.member_feed_posts WHERE id = NEW.post_id;
  IF _author IS NULL OR _author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT display_name INTO _name FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_author, 'feed_reaction', 'Seu post recebeu uma reação',
          coalesce(_name, 'Alguém') || ' reagiu ' || NEW.emoji, '/dashboard/feed');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_feed_post_reaction
  AFTER INSERT ON public.feed_post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_feed_post_reaction();

-- funções SECURITY DEFINER: sem execução para anon/PUBLIC
REVOKE ALL ON FUNCTION public.notify_feed_post_comment() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_feed_post_reaction() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_feed_post_comment() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_feed_post_reaction() TO service_role;
