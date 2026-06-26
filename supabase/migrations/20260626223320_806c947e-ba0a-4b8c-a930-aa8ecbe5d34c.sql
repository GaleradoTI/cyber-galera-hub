-- Storage policies for public-site assets under project-covers/site/*.
-- Fixes RLS denial for community profile photos, mascots, favicon and other site-managed images.

DROP POLICY IF EXISTS "Admin envia assets do site" ON storage.objects;
DROP POLICY IF EXISTS "Admin atualiza assets do site" ON storage.objects;
DROP POLICY IF EXISTS "Admin remove assets do site" ON storage.objects;

CREATE POLICY "Admin envia assets do site"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
);

CREATE POLICY "Admin atualiza assets do site"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
)
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
);

CREATE POLICY "Admin remove assets do site"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
);

-- Ensure the editable mascot configuration supports page-specific placements by default.
UPDATE public.public_site_settings
SET setting_value = jsonb_build_object(
  'items', COALESCE(setting_value->'items', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('name', 'Mascote Sobre', 'image_url', '', 'placement', 'about', 'caption', 'Nossa história também tem personagem.'),
    jsonb_build_object('name', 'Mascote Embaixadores', 'image_url', '', 'placement', 'ambassadors', 'caption', 'Quem puxa a comunidade para frente.'),
    jsonb_build_object('name', 'Mascote Administradores', 'image_url', '', 'placement', 'administrators', 'caption', 'Organização, segurança e comunidade.'),
    jsonb_build_object('name', 'Mascote Rodapé', 'image_url', '', 'placement', 'footer', 'caption', 'Até o próximo deploy!')
  ),
  'updated_at', to_jsonb(now())
)
WHERE setting_key = 'mascots'
  AND jsonb_typeof(setting_value) = 'object'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(setting_value->'items', '[]'::jsonb)) item
    WHERE item->>'placement' IN ('about', 'ambassadors', 'administrators')
  );