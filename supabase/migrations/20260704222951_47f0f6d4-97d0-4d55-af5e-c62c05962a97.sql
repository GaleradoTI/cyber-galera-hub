
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'EMBAIXADOR';

ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS community_profiles_user_id_idx
  ON public.community_profiles(user_id);
