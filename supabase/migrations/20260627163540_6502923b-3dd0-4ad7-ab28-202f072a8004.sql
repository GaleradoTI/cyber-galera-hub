CREATE OR REPLACE FUNCTION public.can_upload_storage_object(_bucket text, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _first_folder text := (storage.foldername(_name))[1];
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  -- Usuários autenticados podem gerenciar apenas o próprio avatar em avatars/<user_id>/*.
  IF _bucket = 'avatars' THEN
    RETURN _first_folder = _uid::text;
  END IF;

  -- Eventos continuam aceitando upload de usuários autenticados.
  IF _bucket = 'project-covers' AND _first_folder = 'events' THEN
    RETURN true;
  END IF;

  -- Assets administrativos: drops, mascotes, favicon e perfis públicos ficam sob project-covers/drops/* ou project-covers/site/*.
  IF _bucket = 'project-covers' AND _first_folder IN ('drops', 'site') THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  -- Mantém compatibilidade com capas administrativas legadas de projeto no bucket project-covers.
  IF _bucket = 'project-covers' THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_upload_storage_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_storage_object(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_update_storage_object(_bucket text, _name text, _owner uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _first_folder text := (storage.foldername(_name))[1];
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  IF _bucket = 'avatars' THEN
    RETURN _first_folder = _uid::text;
  END IF;

  IF _bucket = 'project-covers' AND _first_folder = 'events' THEN
    RETURN COALESCE(_owner, _uid) = _uid OR public.is_admin_or_super(_uid);
  END IF;

  IF _bucket = 'project-covers' AND _first_folder IN ('drops', 'site') THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  IF _bucket = 'project-covers' THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_update_storage_object(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_update_storage_object(text, text, uuid) TO authenticated;

DROP POLICY IF EXISTS "Admin envia imagem de drop" ON storage.objects;
DROP POLICY IF EXISTS "Admin atualiza imagem de drop" ON storage.objects;
DROP POLICY IF EXISTS "Admin remove imagem de drop" ON storage.objects;
DROP POLICY IF EXISTS "Admin envia assets do site" ON storage.objects;
DROP POLICY IF EXISTS "Admin atualiza assets do site" ON storage.objects;
DROP POLICY IF EXISTS "Admin remove assets do site" ON storage.objects;
DROP POLICY IF EXISTS "Admin envia capa de projeto" ON storage.objects;
DROP POLICY IF EXISTS "Admin atualiza capa de projeto" ON storage.objects;
DROP POLICY IF EXISTS "Admin remove capa de projeto" ON storage.objects;
DROP POLICY IF EXISTS "Autenticado envia banner de evento" ON storage.objects;
DROP POLICY IF EXISTS "Autenticado atualiza banner de evento que enviou" ON storage.objects;
DROP POLICY IF EXISTS "Usuário envia próprio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuário atualiza próprio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuário remove próprio avatar" ON storage.objects;

CREATE POLICY "Storage upload permitido por contexto"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (public.can_upload_storage_object(bucket_id, name));

CREATE POLICY "Storage atualização permitida por contexto"
ON storage.objects
FOR UPDATE
TO authenticated
USING (public.can_update_storage_object(bucket_id, name, owner))
WITH CHECK (public.can_upload_storage_object(bucket_id, name));

CREATE POLICY "Storage remoção permitida por contexto"
ON storage.objects
FOR DELETE
TO authenticated
USING (public.can_update_storage_object(bucket_id, name, owner));

CREATE OR REPLACE FUNCTION public.get_storage_upload_diagnostics(
  _bucket text,
  _prefix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _first_folder text := split_part(coalesce(_prefix, ''), '/', 1);
  _bucket_public boolean;
  _policies jsonb;
  _roles jsonb;
  _probe_name text := trim(both '/' from coalesce(_prefix, '')) || '/diagnostico.png';
BEGIN
  IF _uid IS NULL OR NOT public.is_admin_or_super(_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver diagnóstico de upload';
  END IF;

  SELECT public INTO _bucket_public
  FROM storage.buckets
  WHERE id = _bucket;

  SELECT COALESCE(jsonb_agg(role::text ORDER BY role::text), '[]'::jsonb)
  INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', policyname,
    'command', cmd,
    'roles', roles,
    'using', qual,
    'with_check', with_check
  ) ORDER BY policyname, cmd), '[]'::jsonb)
  INTO _policies
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND (
      coalesce(qual, '') ILIKE '%' || _bucket || '%'
      OR coalesce(with_check, '') ILIKE '%' || _bucket || '%'
      OR coalesce(qual, '') ILIKE '%can_upload_storage_object%'
      OR coalesce(with_check, '') ILIKE '%can_upload_storage_object%'
      OR coalesce(qual, '') ILIKE '%can_update_storage_object%'
      OR coalesce(with_check, '') ILIKE '%can_update_storage_object%'
      OR policyname ILIKE '%storage%'
      OR policyname ILIKE '%drop%'
      OR policyname ILIKE '%asset%'
      OR policyname ILIKE '%avatar%'
    );

  RETURN jsonb_build_object(
    'bucket', _bucket,
    'bucket_public', COALESCE(_bucket_public, false),
    'prefix', _prefix,
    'first_folder', _first_folder,
    'expected_path', _bucket || '/' || _prefix || '/<timestamp>.<ext>',
    'required_role', CASE
      WHEN _bucket = 'project-covers' AND _first_folder IN ('drops', 'site') THEN 'ADMIN ou SUPER_ADMIN'
      WHEN _bucket = 'avatars' THEN 'usuário autenticado dono da pasta'
      ELSE 'usuário autenticado conforme contexto'
    END,
    'current_user_id', _uid,
    'current_user_roles', _roles,
    'current_user_is_admin', public.is_admin_or_super(_uid),
    'can_insert_probe', public.can_upload_storage_object(_bucket, _probe_name),
    'policies', _policies
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storage_upload_diagnostics(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_upload_diagnostics(text, text) TO authenticated;