CREATE OR REPLACE FUNCTION public.can_upload_storage_object(_bucket text, _name text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _folders text[] := storage.foldername(_name);
  _first_folder text := _folders[1];
  _second_folder text := _folders[2];
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket = 'avatars' THEN RETURN _first_folder = _uid::text; END IF;
  IF _bucket = 'project-covers' AND _first_folder = 'events' THEN RETURN true; END IF;
  IF _bucket = 'project-covers' AND _first_folder = 'raffles' AND _second_folder = _uid::text THEN RETURN true; END IF;
  IF _bucket = 'project-covers' AND _first_folder = 'drops' THEN RETURN public.is_admin_or_super(_uid); END IF;
  IF _bucket = 'project-covers' AND _first_folder = 'site' AND _second_folder IN ('mascots','community-profiles','favicon') THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;
  IF _bucket = 'project-covers' THEN RETURN public.is_admin_or_super(_uid); END IF;
  RETURN false;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.can_upload_storage_object(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_upload_storage_object(text, text) TO authenticated;