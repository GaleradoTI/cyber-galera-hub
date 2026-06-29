ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_birth_date_reasonable;

CREATE OR REPLACE FUNCTION public.validate_profile_demographics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL AND (NEW.birth_date < DATE '1900-01-01' OR NEW.birth_date > CURRENT_DATE) THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_demographics_trigger ON public.profiles;
CREATE TRIGGER validate_profile_demographics_trigger
BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_demographics();

REVOKE ALL ON FUNCTION public.can_upload_storage_object(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_storage_object(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.can_update_storage_object(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_update_storage_object(text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_upload_storage_object(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_update_storage_object(text, text, uuid) TO authenticated;