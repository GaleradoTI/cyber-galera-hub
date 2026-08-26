-- =========================================================
-- 1) JOBS: remove política aberta de INSERT (WITH CHECK true)
--    e a política de UPDATE concedida ao papel anon
-- =========================================================
DROP POLICY IF EXISTS "Allow inserts" ON public.jobs;
DROP POLICY IF EXISTS "Bot can update send_to_bot" ON public.jobs;

-- =========================================================
-- 2) PUBLIC_SITE_SETTINGS: remove exposição de chaves sensíveis
-- =========================================================
DROP POLICY IF EXISTS "Settings are public" ON public.public_site_settings;

CREATE POLICY "Public settings readable by anon"
ON public.public_site_settings
FOR SELECT
TO anon
USING (setting_key NOT IN ('password_policy', 'upload_policy'));

CREATE POLICY "Settings readable by authenticated"
ON public.public_site_settings
FOR SELECT
TO authenticated
USING (
  setting_key <> 'password_policy'
  OR public.is_admin_or_super(auth.uid())
);

-- =========================================================
-- 3) Leituras públicas: separa política de anon (sem chamada de
--    função SECURITY DEFINER) da política de autenticados
-- =========================================================

-- channels
DROP POLICY IF EXISTS "Active channels are public" ON public.channels;
CREATE POLICY "Active channels are public"
ON public.channels FOR SELECT TO anon
USING (is_active = true);
CREATE POLICY "Channels visible to authenticated"
ON public.channels FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin_or_super(auth.uid()));

-- faqs
DROP POLICY IF EXISTS "Active FAQs are public" ON public.faqs;
CREATE POLICY "Active FAQs are public"
ON public.faqs FOR SELECT TO anon
USING (is_active = true);
CREATE POLICY "FAQs visible to authenticated"
ON public.faqs FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin_or_super(auth.uid()));

-- partners
DROP POLICY IF EXISTS "Active partners are public" ON public.partners;
CREATE POLICY "Active partners are public"
ON public.partners FOR SELECT TO anon
USING (is_active = true);
CREATE POLICY "Partners visible to authenticated"
ON public.partners FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin_or_super(auth.uid()));

-- community_profiles
DROP POLICY IF EXISTS "Public can view active community profiles" ON public.community_profiles;
CREATE POLICY "Active community profiles are public"
ON public.community_profiles FOR SELECT TO anon
USING (is_active = true);
CREATE POLICY "Community profiles visible to authenticated"
ON public.community_profiles FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin_or_super(auth.uid()));

-- drops
DROP POLICY IF EXISTS "drops public read published" ON public.drops;
CREATE POLICY "drops public read published"
ON public.drops FOR SELECT TO anon
USING (status = 'published');
CREATE POLICY "drops read for authenticated"
ON public.drops FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin_or_super(auth.uid()));

-- jobs
DROP POLICY IF EXISTS "Published jobs are public" ON public.jobs;
CREATE POLICY "Published jobs are public"
ON public.jobs FOR SELECT TO anon
USING (status = 'publicado'::content_status);
CREATE POLICY "Jobs visible to authenticated"
ON public.jobs FOR SELECT TO authenticated
USING (status = 'publicado'::content_status OR public.is_admin_or_super(auth.uid()));

-- =========================================================
-- 4) Demais políticas que dependem de checagem de papel deixam
--    de valer para o papel anon (passam a ser TO authenticated)
-- =========================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text = '{public}'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~
          '(has_role|is_admin_or_super|is_recruiter|is_project_member|is_project_leader|is_squad_member|is_squad_leader|users_share_project)'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =========================================================
-- 5) Funções SECURITY DEFINER deixam de ser executáveis por anon
-- =========================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           p.proname,
           p.prorettype = 'pg_catalog.trigger'::regtype AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);

    IF NOT r.is_trigger AND r.proname <> 'promote_user_to_super_admin' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;
