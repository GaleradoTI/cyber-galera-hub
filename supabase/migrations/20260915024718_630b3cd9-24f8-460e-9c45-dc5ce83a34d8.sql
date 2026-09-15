CREATE OR REPLACE FUNCTION public.log_raffle_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row jsonb := to_jsonb(COALESCE(NEW, OLD));
  _desc text;
BEGIN
  IF TG_TABLE_NAME = 'raffles' THEN
    _desc := COALESCE(_row->>'title', 'Rifa');
  ELSIF TG_TABLE_NAME = 'raffle_prizes' THEN
    _desc := 'Prêmio: ' || COALESCE(_row->>'title', '');
  ELSE
    _desc := 'Número ' || COALESCE(_row->>'number', _row->>'label', '—') || ' — ' || COALESCE(_row->>'status', '');
  END IF;

  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), TG_OP, TG_TABLE_NAME, _row->>'id', _desc);

  RETURN COALESCE(NEW, OLD);
END $function$;