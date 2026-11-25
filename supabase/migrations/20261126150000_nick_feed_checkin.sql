-- Nick do site, nomes visíveis no feed e check-in com nome + nick.
-- Só acrescenta; o código publicado continua funcionando. Pode ser executado mais de uma vez.
BEGIN;

-- ========== 1) Nick ==========
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text;

CREATE OR REPLACE FUNCTION public.slugify_nickname(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  WITH s AS (
    SELECT btrim(regexp_replace(
      translate(lower(coalesce(_name,'')),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
        'aaaaaaeeeeiiiiooooouuuucnyaaaaaaeeeeiiiiooooouuuucny'),
      '[^a-z0-9]+', '.', 'g'), '.') AS v
  ), cut AS (SELECT btrim(left(v, 20), '.') AS v FROM s)
  -- nome com formato de e-mail não vira nick (não expõe o endereço)
  SELECT CASE WHEN position('@' in coalesce(_name,'')) > 0 OR char_length(v) < 3 THEN 'membro' ELSE v END FROM cut
$$;

CREATE OR REPLACE FUNCTION public.next_free_nickname(_name text, _uid uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text := public.slugify_nickname(_name); candidate text; n int := 1;
BEGIN
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(nickname) = candidate AND user_id <> _uid) LOOP
    n := n + 1;
    candidate := base || n;
  END LOOP;
  RETURN candidate;
END $$;
REVOKE ALL ON FUNCTION public.next_free_nickname(text, uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id, display_name FROM public.profiles WHERE nickname IS NULL ORDER BY created_at, user_id LOOP
    UPDATE public.profiles SET nickname = public.next_free_nickname(r.display_name, r.user_id) WHERE user_id = r.user_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_unique ON public.profiles (lower(nickname));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nickname_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nickname_format
  CHECK (nickname IS NULL OR nickname ~ '^[a-z0-9._]{3,24}$');

CREATE OR REPLACE FUNCTION public.fill_profile_nickname()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nickname IS NOT DISTINCT FROM OLD.nickname AND NEW.nickname IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.nickname := lower(btrim(ltrim(btrim(coalesce(NEW.nickname,'')), '@')));
  IF NEW.nickname = '' THEN
    NEW.nickname := public.next_free_nickname(NEW.display_name, NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fill_profile_nickname() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_fill_profile_nickname ON public.profiles;
CREATE TRIGGER b_fill_profile_nickname BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fill_profile_nickname();

-- ========== 2) Dados públicos de autores (sem e-mail, telefone etc.) ==========
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text, nickname text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.display_name, p.nickname, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND NOT public.is_user_blocked(auth.uid())
    AND p.user_id = ANY(_ids[1:200])
$$;
REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'user_id', p.user_id, 'display_name', p.display_name, 'nickname', p.nickname,
    'avatar_url', p.avatar_url, 'bio', p.bio,
    'followers', (SELECT count(*) FROM public.user_follows WHERE following_id = p.user_id),
    'following', (SELECT count(*) FROM public.user_follows WHERE follower_id = p.user_id),
    'posts', (SELECT count(*) FROM public.member_feed_posts WHERE author_id = p.user_id AND status <> 'deleted'))
  FROM public.profiles p WHERE p.user_id = _user_id AND p.is_blocked = false
$$;

-- ========== 3) Check-in ==========
CREATE OR REPLACE FUNCTION public.checkin_by_code(_code text, _event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.event_registrations; p public.profiles; uid uuid := auth.uid(); already boolean; outcome text;
BEGIN
  IF NOT (public.is_admin_or_super(uid) OR public.has_ambassador_permission(uid,'eventos:checkin')) THEN
    RAISE EXCEPTION 'Sem acesso para confirmar presença'; END IF;
  SELECT * INTO r FROM public.event_registrations WHERE ticket_code = upper(trim(_code)) AND event_id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','not_found'); END IF;
  SELECT * INTO p FROM public.profiles WHERE user_id = r.user_id;
  IF r.status <> 'approved' THEN
    outcome := 'not_approved';
  ELSE
    already := r.checked_in_at IS NOT NULL;
    outcome := CASE WHEN already THEN 'already' ELSE 'ok' END;
    IF NOT already THEN
      UPDATE public.event_registrations SET checked_in_at = now(), checked_in_by = uid WHERE id = r.id RETURNING * INTO r;
      INSERT INTO public.event_checkins(event_id,user_id,source) VALUES (r.event_id,r.user_id,'qrcode') ON CONFLICT DO NOTHING;
      INSERT INTO public.notifications(user_id,type,title,body,link)
        VALUES (r.user_id,'event_registration','Presença registrada','Seu check-in foi confirmado. Seu ingresso está no perfil.','/dashboard/perfil');
    END IF;
  END IF;
  RETURN jsonb_build_object('result', outcome, 'user_id', p.user_id, 'name', p.display_name, 'nickname', p.nickname,
    'avatar_url', p.avatar_url, 'work_area', p.work_area, 'registration_status', r.status, 'checked_in_at', r.checked_in_at);
END $$;

-- Lista de participantes para a organização. Contato só para quem gerencia inscrições
-- (antes, embaixadores via "Usuário" porque não podem ler a tabela de perfis).
CREATE OR REPLACE FUNCTION public.get_event_participants(_event_id uuid)
RETURNS TABLE (user_id uuid, display_name text, nickname text, avatar_url text, work_area text, email text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT public.is_admin_or_super(auth.uid()) OR public.has_ambassador_permission(auth.uid(),'eventos:inscricoes') AS manage,
           public.has_ambassador_permission(auth.uid(),'eventos:checkin') AS scan
  )
  SELECT p.user_id, p.display_name, p.nickname, p.avatar_url, p.work_area,
         CASE WHEN me.manage THEN p.email END, CASE WHEN me.manage THEN p.phone END
  FROM me, public.event_registrations r JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.event_id = _event_id AND (me.manage OR me.scan)
$$;
REVOKE ALL ON FUNCTION public.get_event_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_participants(uuid) TO authenticated;

COMMIT;
