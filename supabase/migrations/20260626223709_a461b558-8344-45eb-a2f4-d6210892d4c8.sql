-- Public aggregate counters for the home page. No personal data is exposed.
CREATE TABLE IF NOT EXISTS public.public_home_stats (
  id boolean PRIMARY KEY DEFAULT true,
  members_count integer NOT NULL DEFAULT 0,
  recruiters_count integer NOT NULL DEFAULT 0,
  jobs_count integer NOT NULL DEFAULT 0,
  events_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_home_stats_single_row CHECK (id = true)
);

GRANT SELECT ON public.public_home_stats TO anon, authenticated;
GRANT ALL ON public.public_home_stats TO service_role;

ALTER TABLE public.public_home_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads home stats" ON public.public_home_stats;
CREATE POLICY "Public reads home stats"
ON public.public_home_stats
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.recalculate_public_home_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.public_home_stats (
    id,
    members_count,
    recruiters_count,
    jobs_count,
    events_count,
    updated_at
  )
  VALUES (
    true,
    COALESCE((SELECT count(*) FROM public.profiles WHERE is_blocked = false), 0),
    COALESCE((
      SELECT count(DISTINCT p.user_id)
      FROM public.profiles p
      LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role::text = 'RECRUTADOR'
      WHERE p.is_blocked = false
        AND (p.is_verified_recruiter = true OR ur.user_id IS NOT NULL)
    ), 0),
    COALESCE((SELECT count(*) FROM public.jobs WHERE status::text = 'publicado'), 0),
    COALESCE((SELECT count(*) FROM public.events WHERE status::text = 'publicado' AND approval_status = 'approved'), 0),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    members_count = EXCLUDED.members_count,
    recruiters_count = EXCLUDED.recruiters_count,
    jobs_count = EXCLUDED.jobs_count,
    events_count = EXCLUDED.events_count,
    updated_at = EXCLUDED.updated_at;
$$;

CREATE OR REPLACE FUNCTION public.refresh_public_home_stats_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_public_home_stats();
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_public_home_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_public_home_stats_trigger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_public_home_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_public_home_stats_trigger() TO service_role;

-- Keep the earlier RPC private; home reads the aggregate table instead.
REVOKE ALL ON FUNCTION public.get_public_home_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_home_stats() TO service_role;

DROP TRIGGER IF EXISTS refresh_home_stats_profiles ON public.profiles;
CREATE TRIGGER refresh_home_stats_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_public_home_stats_trigger();

DROP TRIGGER IF EXISTS refresh_home_stats_user_roles ON public.user_roles;
CREATE TRIGGER refresh_home_stats_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_public_home_stats_trigger();

DROP TRIGGER IF EXISTS refresh_home_stats_jobs ON public.jobs;
CREATE TRIGGER refresh_home_stats_jobs
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_public_home_stats_trigger();

DROP TRIGGER IF EXISTS refresh_home_stats_events ON public.events;
CREATE TRIGGER refresh_home_stats_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_public_home_stats_trigger();

SELECT public.recalculate_public_home_stats();