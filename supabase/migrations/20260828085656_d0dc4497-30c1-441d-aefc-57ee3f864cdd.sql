ALTER TABLE public.member_feed_posts
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}'::text[];