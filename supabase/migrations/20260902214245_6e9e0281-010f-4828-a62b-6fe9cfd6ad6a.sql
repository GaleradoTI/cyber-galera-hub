CREATE POLICY "No client reads password reset codes"
ON public.password_reset_codes
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "No client creates password reset codes"
ON public.password_reset_codes
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "No client changes password reset codes"
ON public.password_reset_codes
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No client deletes password reset codes"
ON public.password_reset_codes
FOR DELETE
TO anon, authenticated
USING (false);