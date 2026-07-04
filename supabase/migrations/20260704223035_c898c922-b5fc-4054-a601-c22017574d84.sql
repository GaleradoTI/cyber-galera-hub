
DROP POLICY IF EXISTS "Ambassadors update own community profile" ON public.community_profiles;
CREATE POLICY "Ambassadors update own community profile"
ON public.community_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'EMBAIXADOR'::app_role))
WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'EMBAIXADOR'::app_role));
