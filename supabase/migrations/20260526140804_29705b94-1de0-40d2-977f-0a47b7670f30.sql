
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
