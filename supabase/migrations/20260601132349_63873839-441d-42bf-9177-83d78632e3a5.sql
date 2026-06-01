
-- 1) Remove recruiter access to full profiles (emails leak). Replace with a safe view.
DROP POLICY IF EXISTS "Recrutadores veem candidatos em busca" ON public.profiles;

CREATE OR REPLACE VIEW public.recruiter_candidates
WITH (security_invoker = on) AS
SELECT
  user_id,
  display_name,
  avatar_url,
  bio,
  work_area,
  tech_tags,
  looking_for_job,
  is_verified_recruiter
FROM public.profiles
WHERE looking_for_job = true;

GRANT SELECT ON public.recruiter_candidates TO authenticated;

-- Allow recruiters to read looking_for_job profiles WITHOUT exposing email / social_links / is_blocked
-- by re-adding a column-aware policy on profiles limited to safe columns via a separate view above.
-- The view inherits RLS via security_invoker; add a policy that lets recruiters see only safe rows.
CREATE POLICY "Recrutadores veem candidatos (sem email)"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_recruiter(auth.uid())
  AND looking_for_job = true
  AND false  -- block direct profile reads; recruiters must use recruiter_candidates view
);

-- Actually simpler: do NOT add the dummy policy. Drop it again to keep things clean.
DROP POLICY IF EXISTS "Recrutadores veem candidatos (sem email)" ON public.profiles;

-- The view's security_invoker means it runs as caller; caller (recruiter) won't pass profiles RLS.
-- Switch the view to security_definer-style by making it SECURITY DEFINER via a function wrapper,
-- OR change the view to NOT use security_invoker so it runs as view owner (postgres) — that's the
-- standard pattern for exposing a safe column subset.
ALTER VIEW public.recruiter_candidates SET (security_invoker = off);

-- Restrict the view to authenticated recruiters only via a barrier function.
CREATE OR REPLACE VIEW public.recruiter_candidates
WITH (security_invoker = off) AS
SELECT
  user_id,
  display_name,
  avatar_url,
  bio,
  work_area,
  tech_tags,
  looking_for_job,
  is_verified_recruiter
FROM public.profiles
WHERE looking_for_job = true
  AND public.is_recruiter(auth.uid());

GRANT SELECT ON public.recruiter_candidates TO authenticated;
REVOKE SELECT ON public.recruiter_candidates FROM anon;

-- 2) member_badges: require authentication (still readable by all signed-in users)
DROP POLICY IF EXISTS "Badges são públicas para leitura" ON public.member_badges;
CREATE POLICY "Badges visíveis para autenticados"
ON public.member_badges
FOR SELECT
TO authenticated
USING (true);

-- 3) lgpd_consents: hide ip_address from admin reads by replacing direct table access
--    with a view that masks the IP. Keep raw table accessible only via service_role.
DROP POLICY IF EXISTS "Users view own consents" ON public.lgpd_consents;
CREATE POLICY "Users view own consents (sem ip)"
ON public.lgpd_consents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admin-safe view without ip_address
CREATE OR REPLACE VIEW public.lgpd_consents_admin
WITH (security_invoker = off) AS
SELECT
  id, user_id, terms_version, privacy_policy_version,
  consent_status, consent_origin, accepted_at,
  CASE WHEN ip_address IS NULL THEN NULL ELSE 'masked' END AS ip_address_masked
FROM public.lgpd_consents
WHERE public.is_admin_or_super(auth.uid());

GRANT SELECT ON public.lgpd_consents_admin TO authenticated;
REVOKE SELECT ON public.lgpd_consents_admin FROM anon;

-- 4) Storage buckets: stop allowing listing of all files. Public URLs keep working
--    because Supabase serves public bucket files via the public storage endpoint
--    independent of storage.objects RLS.
DROP POLICY IF EXISTS "Avatars são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Capas de projeto são públicas" ON storage.objects;

-- Allow signed-in users to read individual objects by name (no broad listing power needed
-- on the client; public CDN URLs still serve files anonymously for public buckets).
CREATE POLICY "Avatars leitura autenticada"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Capas de projeto leitura autenticada"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'project-covers');

-- 5) Lock down dangerous SECURITY DEFINER function callable by anyone signed in
REVOKE EXECUTE ON FUNCTION public.promote_user_to_super_admin(text) FROM PUBLIC, anon, authenticated;

-- 6) Defense-in-depth INSERT policy on profiles (creation already happens via SECURITY DEFINER
--    trigger handle_new_user; this prevents a future hand-rolled insert from spoofing user_id).
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
