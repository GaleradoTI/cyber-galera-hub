CREATE OR REPLACE FUNCTION public.get_storage_upload_diagnostics(
  _bucket text,
  _prefix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _first_folder text := split_part(coalesce(_prefix, ''), '/', 1);
  _bucket_public boolean;
  _policies jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin_or_super(_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver diagnóstico de upload';
  END IF;

  SELECT public INTO _bucket_public
  FROM storage.buckets
  WHERE id = _bucket;

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
      qual ILIKE '%' || _bucket || '%'
      OR with_check ILIKE '%' || _bucket || '%'
      OR policyname ILIKE '%drop%'
      OR policyname ILIKE '%asset%'
      OR policyname ILIKE '%capa%'
      OR policyname ILIKE '%avatar%'
    )
    AND (
      _first_folder = ''
      OR qual ILIKE '%' || _first_folder || '%'
      OR with_check ILIKE '%' || _first_folder || '%'
      OR policyname ILIKE '%' || _first_folder || '%'
      OR (_first_folder = 'site' AND policyname ILIKE '%asset%')
      OR (_first_folder = 'drops' AND policyname ILIKE '%drop%')
    );

  RETURN jsonb_build_object(
    'bucket', _bucket,
    'bucket_public', COALESCE(_bucket_public, false),
    'prefix', _prefix,
    'first_folder', _first_folder,
    'expected_path', _bucket || '/' || _prefix || '/<timestamp>.<ext>',
    'required_role', CASE WHEN _bucket = 'project-covers' AND _first_folder IN ('drops', 'site') THEN 'ADMIN ou SUPER_ADMIN' ELSE 'usuário autenticado conforme policy' END,
    'current_user_id', _uid,
    'current_user_is_admin', public.is_admin_or_super(_uid),
    'policies', _policies
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storage_upload_diagnostics(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_upload_diagnostics(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_image_upload_attempt(
  _context text,
  _bucket text,
  _path text,
  _status text,
  _reason text DEFAULT NULL,
  _file_name text DEFAULT NULL,
  _file_type text DEFAULT NULL,
  _file_size bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _action text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  _action := CASE WHEN lower(COALESCE(_status, '')) = 'success'
    THEN 'IMAGE_UPLOAD_SUCCESS'
    ELSE 'IMAGE_UPLOAD_FAILED'
  END;

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (
    _uid,
    public._audit_actor_name(_uid),
    _action,
    COALESCE(NULLIF(_context, ''), 'image_uploads'),
    COALESCE(NULLIF(_path, ''), _bucket),
    'Contexto: ' || COALESCE(_context, '—') ||
    ' · Status: ' || COALESCE(_status, 'unknown') ||
    ' · Bucket: ' || COALESCE(_bucket, '—') ||
    ' · Caminho: ' || COALESCE(_path, '—') ||
    ' · Arquivo: ' || COALESCE(_file_name, '—') ||
    ' · Tipo: ' || COALESCE(_file_type, '—') ||
    ' · Tamanho: ' || COALESCE(_file_size::text, '—') || ' bytes' ||
    CASE WHEN _reason IS NOT NULL AND _reason <> '' THEN ' · Motivo: ' || left(_reason, 900) ELSE '' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_image_upload_attempt(text, text, text, text, text, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_image_upload_attempt(text, text, text, text, text, text, text, bigint) TO authenticated;