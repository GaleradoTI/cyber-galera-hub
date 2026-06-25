-- Permite admin/super_admin enviarem imagens de drops em project-covers/drops/*
-- Usa checagem inline em user_roles para evitar dependência da função SECURITY DEFINER.
DROP POLICY IF EXISTS "Admin envia imagem de drop" ON storage.objects;
CREATE POLICY "Admin envia imagem de drop"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN','SUPER_ADMIN')
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
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN','SUPER_ADMIN')
  )
)
WITH CHECK (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
);

DROP POLICY IF EXISTS "Admin remove imagem de drop" ON storage.objects;
CREATE POLICY "Admin remove imagem de drop"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-covers'
  AND (storage.foldername(name))[1] = 'drops'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ADMIN','SUPER_ADMIN')
  )
);

-- Garante que o role authenticated consegue ler user_roles (necessário para as policies inline acima).
GRANT SELECT ON public.user_roles TO authenticated;