
-- Drop the linter-flagged views
DROP VIEW IF EXISTS public.recruiter_candidates;
DROP VIEW IF EXISTS public.lgpd_consents_admin;

-- Recruiter candidates: function returning only safe columns
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
    AND public.is_recruiter(auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION public.get_recruiter_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recruiter_candidates() TO authenticated;

-- Admin consent list with masked IP
CREATE OR REPLACE FUNCTION public.get_lgpd_consents_admin()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  terms_version text,
  privacy_policy_version text,
  consent_status boolean,
  consent_origin text,
  accepted_at timestamptz,
  ip_address_masked text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.user_id, c.terms_version, c.privacy_policy_version,
         c.consent_status, c.consent_origin, c.accepted_at,
         CASE WHEN c.ip_address IS NULL THEN NULL ELSE 'masked' END
  FROM public.lgpd_consents c
  WHERE public.is_admin_or_super(auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION public.get_lgpd_consents_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lgpd_consents_admin() TO authenticated;

-- Remove broad authenticated SELECT on storage objects for these buckets;
-- public CDN URLs continue serving files for public buckets without RLS.
DROP POLICY IF EXISTS "Avatars leitura autenticada" ON storage.objects;
DROP POLICY IF EXISTS "Capas de projeto leitura autenticada" ON storage.objects;
