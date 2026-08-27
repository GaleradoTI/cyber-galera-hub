DROP VIEW IF EXISTS public.public_testimonials;

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_avatar_url text,
  ADD COLUMN IF NOT EXISTS author_work_area text;

CREATE OR REPLACE FUNCTION public.sync_testimonial_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT p.display_name, p.avatar_url, p.work_area
    INTO NEW.author_name, NEW.author_avatar_url, NEW.author_work_area
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_testimonial_author ON public.testimonials;
CREATE TRIGGER trg_sync_testimonial_author
  BEFORE INSERT OR UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.sync_testimonial_author();

CREATE OR REPLACE FUNCTION public.sync_testimonials_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     OR NEW.work_area IS DISTINCT FROM OLD.work_area THEN
    UPDATE public.testimonials
       SET author_name = NEW.display_name,
           author_avatar_url = NEW.avatar_url,
           author_work_area = NEW.work_area
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_testimonials_on_profile_change ON public.profiles;
CREATE TRIGGER trg_sync_testimonials_on_profile_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_testimonials_on_profile_change();

REVOKE ALL ON FUNCTION public.sync_testimonial_author() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_testimonials_on_profile_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_testimonial_author() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_testimonials_on_profile_change() TO service_role;
