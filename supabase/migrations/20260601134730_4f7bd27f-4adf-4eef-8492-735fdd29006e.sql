-- Restore EXECUTE on helper functions used inside RLS policies.
-- These functions are SECURITY DEFINER, but the calling role still needs
-- EXECUTE to invoke them when Postgres evaluates RLS predicates.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_recruiter(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_squad_leader(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_squad_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_leader(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO anon, authenticated;