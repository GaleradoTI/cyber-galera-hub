
-- ========== Permissões por embaixador ==========
CREATE TABLE IF NOT EXISTS public.ambassador_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  areas text[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ambassador_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ambassador_permissions TO authenticated;
GRANT ALL ON public.ambassador_permissions TO service_role;
ALTER TABLE public.ambassador_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin reads ambassador permissions" ON public.ambassador_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage ambassador permissions" ON public.ambassador_permissions
  FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER trg_ambassador_permissions_updated BEFORE UPDATE ON public.ambassador_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_ambassador_permission(_user_id uuid, _area text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'EMBAIXADOR'::app_role) AND EXISTS (
    SELECT 1 FROM public.ambassador_permissions p WHERE p.user_id = _user_id AND _area = ANY(p.areas)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_ambassador_permission(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_ambassador_permission(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_ambassador_permission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description, diff)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), TG_OP, 'ambassador_permissions',
    COALESCE(NEW.user_id, OLD.user_id)::text, 'Acessos de embaixador alterados',
    jsonb_build_object('before', CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END, 'after', CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END));
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_log_ambassador_permissions AFTER INSERT OR UPDATE OR DELETE ON public.ambassador_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_ambassador_permission_change();

-- Policies que liberam cada área
CREATE POLICY "Ambassador eventos select" ON public.events FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'eventos'));
CREATE POLICY "Ambassador eventos insert" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_ambassador_permission(auth.uid(), 'eventos'));
CREATE POLICY "Ambassador eventos update" ON public.events FOR UPDATE TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'eventos')) WITH CHECK (public.has_ambassador_permission(auth.uid(), 'eventos'));
CREATE POLICY "Ambassador eventos delete" ON public.events FOR DELETE TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'eventos'));

CREATE POLICY "Ambassador vagas select" ON public.jobs FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'vagas'));
CREATE POLICY "Ambassador vagas insert" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.has_ambassador_permission(auth.uid(), 'vagas'));
CREATE POLICY "Ambassador vagas update" ON public.jobs FOR UPDATE TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'vagas')) WITH CHECK (public.has_ambassador_permission(auth.uid(), 'vagas'));
CREATE POLICY "Ambassador vagas delete" ON public.jobs FOR DELETE TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'vagas'));

CREATE POLICY "Ambassador parceiros all" ON public.partners FOR ALL TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'parceiros')) WITH CHECK (public.has_ambassador_permission(auth.uid(), 'parceiros'));
CREATE POLICY "Ambassador faqs all" ON public.faqs FOR ALL TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'faqs')) WITH CHECK (public.has_ambassador_permission(auth.uid(), 'faqs'));

CREATE POLICY "Ambassador depoimentos select" ON public.testimonials FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'depoimentos'));
CREATE POLICY "Ambassador depoimentos update" ON public.testimonials FOR UPDATE TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'depoimentos')) WITH CHECK (public.has_ambassador_permission(auth.uid(), 'depoimentos'));

CREATE POLICY "Ambassador denuncias select" ON public.reports FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'denuncias'));
CREATE POLICY "Ambassador denuncias update" ON public.reports FOR UPDATE TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'denuncias')) WITH CHECK (public.has_ambassador_permission(auth.uid(), 'denuncias'));

CREATE POLICY "Ambassador feed moderate select" ON public.member_feed_posts FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(), 'feed') OR public.has_ambassador_permission(auth.uid(), 'noticias'));
CREATE POLICY "Ambassador news insert" ON public.member_feed_posts FOR INSERT TO authenticated WITH CHECK (kind = 'news' AND author_id = auth.uid() AND public.has_ambassador_permission(auth.uid(), 'noticias'));
DROP POLICY IF EXISTS "Only admins create news" ON public.member_feed_posts;
CREATE POLICY "Only admins create news" ON public.member_feed_posts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((kind <> 'news') OR public.is_admin_or_super(auth.uid()) OR public.has_ambassador_permission(auth.uid(), 'noticias'));
DROP POLICY IF EXISTS "Only admins edit news" ON public.member_feed_posts;
CREATE POLICY "Only admins edit news" ON public.member_feed_posts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((kind <> 'news') OR public.is_admin_or_super(auth.uid()) OR public.has_ambassador_permission(auth.uid(), 'noticias'))
  WITH CHECK ((kind <> 'news') OR public.is_admin_or_super(auth.uid()) OR public.has_ambassador_permission(auth.uid(), 'noticias'));
CREATE POLICY "Ambassador moderates feed" ON public.member_feed_posts FOR UPDATE TO authenticated
  USING ((kind <> 'news' AND public.has_ambassador_permission(auth.uid(), 'feed')) OR (kind = 'news' AND public.has_ambassador_permission(auth.uid(), 'noticias')))
  WITH CHECK ((kind <> 'news' AND public.has_ambassador_permission(auth.uid(), 'feed')) OR (kind = 'news' AND public.has_ambassador_permission(auth.uid(), 'noticias')));

-- ========== Preferências de notificação ==========
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_categories text[] NOT NULL DEFAULT '{}',
  push_muted_categories text[] NOT NULL DEFAULT '{}',
  event_reminders boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notification prefs read" ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own notification prefs insert" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own notification prefs update" ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_notification_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notification_category(_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _type ILIKE '%message%' OR _type ILIKE 'dm%' THEN 'mensagens'
    WHEN _type ILIKE '%event%' OR _type ILIKE '%registration%' OR _type ILIKE '%checkin%' THEN 'eventos'
    WHEN _type ILIKE '%job%' OR _type ILIKE '%application%' OR _type ILIKE '%vaga%' THEN 'vagas'
    WHEN _type ILIKE '%follow%' THEN 'seguidores'
    WHEN _type ILIKE '%project%' OR _type ILIKE '%squad%' OR _type ILIKE '%task%' OR _type ILIKE '%join%' THEN 'projetos'
    WHEN _type ILIKE '%comment%' OR _type ILIKE '%reaction%' OR _type ILIKE '%feed%' OR _type ILIKE '%post%' THEN 'interacoes'
    ELSE 'sistema'
  END
$$;

-- Bloqueia avisos de categorias silenciadas e marca push silenciado (pushed_at preenchido evita envio)
CREATE OR REPLACE FUNCTION public.apply_notification_preferences()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; cat text;
BEGIN
  cat := public.notification_category(NEW.type);
  SELECT * INTO p FROM public.notification_preferences WHERE user_id = NEW.user_id;
  IF FOUND THEN
    IF cat <> 'sistema' AND cat = ANY(p.muted_categories) THEN RETURN NULL; END IF;
    IF cat = ANY(p.push_muted_categories) THEN NEW.pushed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_apply_notification_preferences ON public.notifications;
CREATE TRIGGER trg_apply_notification_preferences BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.apply_notification_preferences();

-- Novas vagas: avisa quem está buscando emprego
CREATE OR REPLACE FUNCTION public.notify_job_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'publicado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'publicado') THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT pr.user_id, 'job_published', 'Nova vaga: ' || NEW.title,
      NEW.company || ' · ' || NEW.seniority::text || ' · ' || NEW.modality::text, '/vagas'
    FROM public.profiles pr
    WHERE pr.looking_for_job = true AND pr.is_blocked = false AND pr.user_id IS DISTINCT FROM NEW.created_by;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_job_published ON public.jobs;
CREATE TRIGGER trg_notify_job_published AFTER INSERT OR UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_published();

-- Novos eventos publicados: avisa todos os membros ativos
CREATE OR REPLACE FUNCTION public.notify_event_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'publicado' AND NEW.approval_status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'publicado' OR OLD.approval_status IS DISTINCT FROM 'approved')
     AND NEW.event_date >= current_date THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT pr.user_id, 'event_published', 'Novo evento: ' || NEW.name,
      to_char(NEW.event_date, 'DD/MM') || COALESCE(' · ' || to_char(NEW.event_time, 'HH24:MI'), '') || ' · ' || NEW.modality::text,
      '/eventos/' || NEW.id
    FROM public.profiles pr
    WHERE pr.is_blocked = false AND pr.user_id IS DISTINCT FROM NEW.created_by;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_event_published ON public.events;
CREATE TRIGGER trg_notify_event_published AFTER INSERT OR UPDATE OF status, approval_status ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_published();

-- Lembretes de evento (1 dia antes e no dia)
CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id, kind)
);
GRANT ALL ON public.event_reminders_sent TO service_role;
ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  WITH targets AS (
    SELECT e.id, e.name, e.event_date, e.event_time, r.user_id,
      CASE WHEN e.event_date = today THEN 'day_of' ELSE 'day_before' END AS kind
    FROM public.events e
    JOIN public.event_registrations r ON r.event_id = e.id AND r.status = 'approved'
    LEFT JOIN public.notification_preferences np ON np.user_id = r.user_id
    WHERE e.status = 'publicado' AND e.event_date IN (today, today + 1)
      AND COALESCE(np.event_reminders, true)
  ), ins AS (
    INSERT INTO public.event_reminders_sent(event_id, user_id, kind)
    SELECT id, user_id, kind FROM targets ON CONFLICT DO NOTHING
    RETURNING event_id, user_id, kind
  )
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT i.user_id, 'event_reminder',
    CASE WHEN i.kind = 'day_of' THEN 'É hoje: ' ELSE 'Amanhã: ' END || t.name,
    COALESCE('Começa às ' || to_char(t.event_time, 'HH24:MI') || '. ', '') || 'Leve seu QR Code do ingresso.',
    '/eventos/' || t.id
  FROM ins i JOIN targets t ON t.id = i.event_id AND t.user_id = i.user_id AND t.kind = i.kind;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_event_reminders() FROM anon, authenticated, public;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('gti-event-reminders', '0 * * * *', $$SELECT public.send_event_reminders()$$);
