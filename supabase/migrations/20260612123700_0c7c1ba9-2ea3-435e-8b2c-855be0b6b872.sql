DROP POLICY IF EXISTS "Public sees terceiros events" ON public.events;
DROP POLICY IF EXISTS "Authenticated sees all published events" ON public.events;
CREATE POLICY "Published events are public"
ON public.events FOR SELECT TO public
USING (status = 'publicado' AND approval_status = 'approved');