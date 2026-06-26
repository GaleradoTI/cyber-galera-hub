DROP POLICY IF EXISTS "Admin envia imagem de drop" ON storage.objects;
DROP POLICY IF EXISTS "Admin atualiza imagem de drop" ON storage.objects;
DROP POLICY IF EXISTS "Admin remove imagem de drop" ON storage.objects;

CREATE POLICY "Admin envia imagem de drop"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
);

CREATE POLICY "Admin atualiza imagem de drop"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
)
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
);

CREATE POLICY "Admin remove imagem de drop"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND public.is_admin_or_super(auth.uid())
);