CREATE TABLE public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  ticket_hash text,
  ticket_expires_at timestamptz,
  completed_at timestamptz,
  request_ip text,
  request_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.password_reset_codes TO service_role;

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX password_reset_codes_email_created_idx
  ON public.password_reset_codes (email, created_at DESC);
CREATE INDEX password_reset_codes_user_created_idx
  ON public.password_reset_codes (user_id, created_at DESC);
CREATE INDEX password_reset_codes_active_idx
  ON public.password_reset_codes (email, expires_at DESC)
  WHERE completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_password_reset_code_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email <> lower(trim(NEW.email)) THEN
    RAISE EXCEPTION 'password reset email must be normalized';
  END IF;
  IF NEW.attempts < 0 OR NEW.max_attempts < 1 OR NEW.attempts > NEW.max_attempts THEN
    RAISE EXCEPTION 'invalid password reset attempt counters';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'password reset expiry must be after creation';
  END IF;
  IF NEW.ticket_expires_at IS NOT NULL AND NEW.verified_at IS NULL THEN
    RAISE EXCEPTION 'ticket expiry requires verification';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_password_reset_code_row_trigger
BEFORE INSERT OR UPDATE ON public.password_reset_codes
FOR EACH ROW EXECUTE FUNCTION public.validate_password_reset_code_row();

REVOKE ALL ON FUNCTION public.validate_password_reset_code_row() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_password_reset_code_row() TO service_role;