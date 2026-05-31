
-- Squad events table
CREATE TABLE public.squad_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location_or_link TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_events TO authenticated;
GRANT ALL ON public.squad_events TO service_role;

ALTER TABLE public.squad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros e admins veem squad_events"
  ON public.squad_events FOR SELECT
  USING (is_admin_or_super(auth.uid()) OR is_squad_member(auth.uid(), squad_id));

CREATE POLICY "Líder ou admin cria squad_events"
  ON public.squad_events FOR INSERT
  WITH CHECK (auth.uid() = created_by AND (is_admin_or_super(auth.uid()) OR is_squad_leader(auth.uid(), squad_id)));

CREATE POLICY "Líder ou admin edita squad_events"
  ON public.squad_events FOR UPDATE
  USING (is_admin_or_super(auth.uid()) OR is_squad_leader(auth.uid(), squad_id));

CREATE POLICY "Líder ou admin remove squad_events"
  ON public.squad_events FOR DELETE
  USING (is_admin_or_super(auth.uid()) OR is_squad_leader(auth.uid(), squad_id));

CREATE TRIGGER squad_events_updated_at
  BEFORE UPDATE ON public.squad_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public profiles view (only safe columns; hide email/social_links/is_blocked/looking_for_job)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
  SELECT
    user_id,
    display_name,
    avatar_url,
    bio,
    work_area,
    tech_tags,
    is_verified_recruiter
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
