-- Configuração global de upload usada pelo painel (super admin edita pela UI)
INSERT INTO public.public_site_settings (setting_key, setting_value, description)
VALUES (
  'upload_policy',
  '{
    "defaults": {
      "max_mb": 8,
      "accept": ["image/jpeg", "image/png", "image/webp"],
      "resize_max": 1920
    },
    "avatars": {
      "max_mb": 4,
      "accept": ["image/jpeg", "image/png", "image/webp"],
      "resize_max": 800
    },
    "project_covers": {
      "max_mb": 8,
      "accept": ["image/jpeg", "image/png", "image/webp"],
      "resize_max": 1920
    },
    "event_banners": {
      "max_mb": 8,
      "accept": ["image/jpeg", "image/png", "image/webp"],
      "resize_max": 1920
    },
    "drop_images": {
      "max_mb": 8,
      "accept": ["image/jpeg", "image/png", "image/webp"],
      "resize_max": 1600
    },
    "favicon": {
      "max_mb": 0.5,
      "accept": ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"]
    },
    "documents": {
      "max_mb": 10,
      "accept": ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    }
  }'::jsonb,
  'Política global de uploads: tipos MIME aceitos, tamanho máximo e redimensionamento por contexto.'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = public.public_site_settings.setting_value || EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = now();

-- Grants defensivos usados por policies e pela leitura das configurações via cliente autenticado.
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.public_site_settings TO anon, authenticated;
GRANT UPDATE ON public.public_site_settings TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- Garante que usuários autenticados possam registrar o próprio log (a política original pode não existir em bases antigas).
DROP POLICY IF EXISTS "Authenticated users insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Configuração de upload só pode ser alterada por SUPER_ADMIN; demais settings continuam admin/super.
DROP POLICY IF EXISTS "Admins manage settings - update" ON public.public_site_settings;
CREATE POLICY "Admins manage settings - update"
ON public.public_site_settings
FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN setting_key = 'upload_policy' THEN public.has_role(auth.uid(), 'SUPER_ADMIN'::public.app_role)
    ELSE public.is_admin_or_super(auth.uid())
  END
)
WITH CHECK (
  CASE
    WHEN setting_key = 'upload_policy' THEN public.has_role(auth.uid(), 'SUPER_ADMIN'::public.app_role)
    ELSE public.is_admin_or_super(auth.uid())
  END
);

-- Log detalhado de tentativas de upload de imagem de drop.
CREATE OR REPLACE FUNCTION public.log_drop_image_upload_attempt(
  _drop_id text,
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
  _entity_id text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  _action := CASE WHEN lower(COALESCE(_status, '')) = 'success'
    THEN 'DROP_IMAGE_UPLOAD_SUCCESS'
    ELSE 'DROP_IMAGE_UPLOAD_FAILED'
  END;
  _entity_id := COALESCE(NULLIF(_drop_id, ''), NULLIF(_path, ''), 'drops');

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (
    _uid,
    public._audit_actor_name(_uid),
    _action,
    'drop_image_uploads',
    _entity_id,
    'Status: ' || COALESCE(_status, 'unknown') ||
    ' · Bucket: ' || COALESCE(_bucket, '—') ||
    ' · Caminho: ' || COALESCE(_path, '—') ||
    ' · Arquivo: ' || COALESCE(_file_name, '—') ||
    ' · Tipo: ' || COALESCE(_file_type, '—') ||
    ' · Tamanho: ' || COALESCE(_file_size::text, '—') || ' bytes' ||
    CASE WHEN _reason IS NOT NULL AND _reason <> '' THEN ' · Motivo: ' || left(_reason, 700) ELSE '' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_drop_image_upload_attempt(text, text, text, text, text, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_drop_image_upload_attempt(text, text, text, text, text, text, text, bigint) TO authenticated;

-- Recria a policy específica de drops com checagem por função security definer e WITH CHECK completo.
DROP POLICY IF EXISTS "Admin envia imagem de drop" ON storage.objects;
CREATE POLICY "Admin envia imagem de drop"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND public.is_admin_or_super(auth.uid())
);

DROP POLICY IF EXISTS "Admin atualiza imagem de drop" ON storage.objects;
CREATE POLICY "Admin atualiza imagem de drop"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND public.is_admin_or_super(auth.uid())
)
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND public.is_admin_or_super(auth.uid())
);

DROP POLICY IF EXISTS "Admin remove imagem de drop" ON storage.objects;
CREATE POLICY "Admin remove imagem de drop"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND public.is_admin_or_super(auth.uid())
);