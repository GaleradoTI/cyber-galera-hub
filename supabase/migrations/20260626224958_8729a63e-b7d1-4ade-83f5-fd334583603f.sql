-- Corrige as policies de Storage para uploads administrativos em drops e assets do site.
-- A checagem usa EXISTS direto em user_roles para evitar falhas de execução de função em Storage RLS.

GRANT SELECT ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "Admin envia imagem de drop" ON storage.objects;
CREATE POLICY "Admin envia imagem de drop"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin atualiza imagem de drop" ON storage.objects;
CREATE POLICY "Admin atualiza imagem de drop"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin remove imagem de drop" ON storage.objects;
CREATE POLICY "Admin remove imagem de drop"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin envia assets do site" ON storage.objects;
CREATE POLICY "Admin envia assets do site"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin atualiza assets do site" ON storage.objects;
CREATE POLICY "Admin atualiza assets do site"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin remove assets do site" ON storage.objects;
CREATE POLICY "Admin remove assets do site"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'site'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role)
  )
);