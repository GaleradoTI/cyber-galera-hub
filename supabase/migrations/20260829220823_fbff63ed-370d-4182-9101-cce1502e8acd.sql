ALTER TABLE public.feed_post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.feed_post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS feed_post_comments_parent_idx ON public.feed_post_comments(parent_id);

CREATE TABLE IF NOT EXISTS public.feed_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.feed_post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_comment_reactions TO authenticated;
GRANT ALL ON public.feed_comment_reactions TO service_role;

ALTER TABLE public.feed_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem curtidas de comentários"
  ON public.feed_comment_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Membros curtem comentários"
  ON public.feed_comment_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Autor troca própria curtida de comentário"
  ON public.feed_comment_reactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Autor ou admin remove curtida de comentário"
  ON public.feed_comment_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));