
-- Profiles: restrict SELECT to owner or admins
DROP POLICY IF EXISTS "Profiles visible to everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by owner or admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));

-- Audit logs: remove direct insert by authenticated users
DROP POLICY IF EXISTS "Authenticated users insert audit logs" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated, anon;
GRANT INSERT ON public.audit_logs TO service_role;
