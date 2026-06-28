ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS address_postal_code text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS address_region text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_allowed,
  ADD CONSTRAINT profiles_gender_allowed
    CHECK (gender IS NULL OR gender IN ('feminino', 'masculino', 'nao_binario', 'outro', 'prefiro_nao_informar'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_birth_date_reasonable,
  ADD CONSTRAINT profiles_birth_date_reasonable
    CHECK (birth_date IS NULL OR (birth_date >= DATE '1900-01-01' AND birth_date <= CURRENT_DATE));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_address_state_format,
  ADD CONSTRAINT profiles_address_state_format
    CHECK (address_state IS NULL OR address_state ~ '^[A-Z]{2}$');

INSERT INTO public.public_site_settings (setting_key, setting_value, description)
VALUES (
  'site_fonts',
  jsonb_build_object(
    'preset', 'space_grotesk_inter',
    'heading_font', 'Space Grotesk',
    'body_font', 'Inter',
    'google_fonts_url', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap'
  ),
  'Fontes globais do site'
)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_upload_storage_object(_bucket text, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _folders text[] := storage.foldername(_name);
  _first_folder text := _folders[1];
  _second_folder text := _folders[2];
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  IF _bucket = 'avatars' THEN
    RETURN _first_folder = _uid::text;
  END IF;

  IF _bucket = 'project-covers' AND _first_folder = 'events' THEN
    RETURN true;
  END IF;

  IF _bucket = 'project-covers' AND _first_folder = 'drops' THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  IF _bucket = 'project-covers' AND _first_folder = 'site'
     AND _second_folder IN ('mascots', 'community-profiles', 'favicon') THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  IF _bucket = 'project-covers' THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_update_storage_object(_bucket text, _name text, _owner uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _folders text[] := storage.foldername(_name);
  _first_folder text := _folders[1];
  _second_folder text := _folders[2];
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

  IF _bucket = 'project-covers' AND _first_folder = 'drops' THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  IF _bucket = 'project-covers' AND _first_folder = 'site'
     AND _second_folder IN ('mascots', 'community-profiles', 'favicon') THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  IF _bucket = 'project-covers' THEN
    RETURN public.is_admin_or_super(_uid);
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Storage upload permitido por contexto" ON storage.objects;
DROP POLICY IF EXISTS "Storage atualização permitida por contexto" ON storage.objects;
DROP POLICY IF EXISTS "Storage remoção permitida por contexto" ON storage.objects;
DROP POLICY IF EXISTS "Storage leitura pública para buckets públicos" ON storage.objects;

CREATE POLICY "Storage leitura pública para buckets públicos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id IN ('avatars', 'project-covers')
);

CREATE POLICY "Storage upload permitido por contexto"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_upload_storage_object(bucket_id, name)
);

CREATE POLICY "Storage atualização permitida por contexto"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  public.can_update_storage_object(bucket_id, name, owner)
)
WITH CHECK (
  public.can_upload_storage_object(bucket_id, name)
);

CREATE POLICY "Storage remoção permitida por contexto"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  public.can_update_storage_object(bucket_id, name, owner)
);

GRANT EXECUTE ON FUNCTION public.can_upload_storage_object(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_update_storage_object(text, text, uuid) TO authenticated;