CREATE OR REPLACE FUNCTION public.get_public_home_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'members', COALESCE((SELECT count(*) FROM public.profiles WHERE is_blocked = false), 0),
    'recruiters', COALESCE((
      SELECT count(DISTINCT p.user_id)
      FROM public.profiles p
      LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role::text = 'RECRUTADOR'
      WHERE p.is_blocked = false
        AND (p.is_verified_recruiter = true OR ur.user_id IS NOT NULL)
    ), 0),
    'jobs', COALESCE((SELECT count(*) FROM public.jobs WHERE status::text = 'publicado'), 0),
    'events', COALESCE((SELECT count(*) FROM public.events WHERE status::text = 'publicado' AND approval_status = 'approved'), 0)
  )
$$;

REVOKE ALL ON FUNCTION public.get_public_home_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_home_stats() TO anon, authenticated, service_role;