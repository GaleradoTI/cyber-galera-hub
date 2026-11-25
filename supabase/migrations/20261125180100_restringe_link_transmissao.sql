-- RODAR SÓ DEPOIS que o código novo estiver publicado: o código antigo usa select('*') em events.
-- Visitantes e usuários deixam de ler events.online_link direto; usam get_event_online_link().
-- A chave de serviço (integrações no servidor) continua lendo tudo.
-- Atenção: colunas NOVAS em events precisam de GRANT SELECT (coluna) e entrar em EVENT_COLUMNS.
BEGIN;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'events' AND column_name <> 'online_link';
  EXECUTE 'REVOKE SELECT ON public.events FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.events TO anon, authenticated', cols);
END $$;
COMMIT;
