
CREATE OR REPLACE FUNCTION public.get_recruiter_candidates()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  bio text,
  work_area text,
  tech_tags text[],
  looking_for_job boolean,
  is_verified_recruiter boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url, p.bio, p.work_area,
         p.tech_tags, p.looking_for_job, p.is_verified_recruiter
  FROM public.profiles p
  WHERE p.looking_for_job = true
    AND (public.is_recruiter(auth.uid()) OR public.is_admin_or_super(auth.uid()))
$$;

REVOKE EXECUTE ON FUNCTION public.get_recruiter_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recruiter_candidates() TO authenticated;
