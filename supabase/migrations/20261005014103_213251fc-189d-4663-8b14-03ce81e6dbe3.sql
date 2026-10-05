CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_feed_posts_author ON public.member_feed_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user ON public.feed_post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user ON public.squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squads_project ON public.squads(project_id);
CREATE INDEX IF NOT EXISTS idx_project_posts_project ON public.project_posts(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_links_project ON public.project_task_links(project_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON public.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_drop_interests_drop ON public.drop_interests(drop_id);
CREATE INDEX IF NOT EXISTS idx_drop_variants_drop ON public.drop_variants(drop_id);
CREATE INDEX IF NOT EXISTS idx_raffle_prizes_raffle ON public.raffle_prizes(raffle_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_status_created ON public.testimonials(status, created_at DESC);

CREATE OR REPLACE VIEW public.admin_users_overview
WITH (security_invoker = true) AS
SELECT p.id, p.user_id, p.display_name, p.email, p.avatar_url, p.is_blocked, p.created_at,
       p.is_verified_recruiter, p.gender, p.birth_date, p.address_state, p.address_region,
       p.address_city, p.work_area,
       COALESCE((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = p.user_id), '{}') AS roles,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'label', b.label, 'color', b.color))
                 FROM public.member_badges b WHERE b.user_id = p.user_id), '[]'::jsonb) AS badges
FROM public.profiles p;
REVOKE ALL ON public.admin_users_overview FROM anon, authenticated;
GRANT SELECT ON public.admin_users_overview TO service_role;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE TRIGGER trg_push_subs_updated BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN
    PERFORM net.http_post(
      url := 'https://galera-do-ti.lovable.app/api/public/push/send',
      body := jsonb_build_object('notification_id', NEW.id),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notifications_push AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();