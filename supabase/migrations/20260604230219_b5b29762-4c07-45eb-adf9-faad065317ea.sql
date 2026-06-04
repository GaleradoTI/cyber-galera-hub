
-- 1) phone column on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2) function: do two users share a project?
CREATE OR REPLACE FUNCTION public.users_share_project(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.squad_members ma
    JOIN public.squads sa ON sa.id = ma.squad_id
    JOIN public.squads sb ON sb.project_id = sa.project_id
    JOIN public.squad_members mb ON mb.squad_id = sb.id
    WHERE ma.user_id = _a
      AND mb.user_id = _b
  )
$$;

-- 3) policy: project teammates may view each other's profile
DROP POLICY IF EXISTS "Project teammates view profile" ON public.profiles;
CREATE POLICY "Project teammates view profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.users_share_project(auth.uid(), user_id));

-- 4) site_settings_history table for audit + revert
CREATE TABLE IF NOT EXISTS public.site_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  changed_by uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.site_settings_history TO authenticated;
GRANT ALL ON public.site_settings_history TO service_role;

ALTER TABLE public.site_settings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view site settings history" ON public.site_settings_history;
CREATE POLICY "Admins view site settings history"
ON public.site_settings_history
FOR SELECT
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins insert site settings history" ON public.site_settings_history;
CREATE POLICY "Admins insert site settings history"
ON public.site_settings_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_site_settings_history_key_created
  ON public.site_settings_history (setting_key, created_at DESC);

-- 5) trigger to snapshot OLD values when seo/favicon change
CREATE OR REPLACE FUNCTION public.snapshot_site_setting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF NEW.setting_key IN ('seo', 'favicon')
     AND OLD.setting_value IS DISTINCT FROM NEW.setting_value THEN
    SELECT display_name INTO _name
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1;
    INSERT INTO public.site_settings_history (setting_key, setting_value, changed_by, changed_by_name)
    VALUES (OLD.setting_key, OLD.setting_value, auth.uid(), _name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_site_setting ON public.public_site_settings;
CREATE TRIGGER trg_snapshot_site_setting
  BEFORE UPDATE ON public.public_site_settings
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_site_setting();
