
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_cep_validated_at timestamptz;

CREATE OR REPLACE FUNCTION public.log_cep_lookup(
  _cep text,
  _status text,
  _reason text DEFAULT NULL,
  _http_status integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _action text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  _action := CASE WHEN lower(coalesce(_status,'')) = 'success'
    THEN 'CEP_LOOKUP_SUCCESS' ELSE 'CEP_LOOKUP_FAILED' END;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (
    _uid,
    public._audit_actor_name(_uid),
    _action,
    'viacep',
    coalesce(nullif(_cep,''), 'unknown'),
    'CEP: ' || coalesce(_cep,'—') ||
    ' · Status: ' || coalesce(_status,'unknown') ||
    ' · HTTP: ' || coalesce(_http_status::text, '—') ||
    case when _reason is not null and _reason <> '' then ' · Motivo: ' || left(_reason, 500) else '' end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_cep_lookup(text, text, text, integer) TO authenticated;
