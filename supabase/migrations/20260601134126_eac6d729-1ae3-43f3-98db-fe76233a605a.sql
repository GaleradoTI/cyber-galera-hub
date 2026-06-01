
-- Revoke execute from anon/public for all SECURITY DEFINER helpers in public schema.
-- Keep EXECUTE for `authenticated` so RLS policies referencing these helpers continue to work.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_recruiter(uuid)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_squad_leader(uuid, uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_squad_member(uuid, uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_leader(uuid, uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_recruiter_candidates()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_lgpd_consents_admin()              FROM PUBLIC;

-- Triggers (not called directly): lock down completely.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_verified_recruiter()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_project_post()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_direct_message()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_application()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_squad_leader()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()  FROM PUBLIC, anon, authenticated;
