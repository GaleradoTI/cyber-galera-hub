
-- ============= 1. Torneios =============
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_at date,
  ends_at date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournaments_read_auth" ON public.tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "tournaments_admin_write" ON public.tournaments FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER tournaments_updated BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= 2. Finance: novos campos =============
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid,
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entries_assigned ON public.finance_entries(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_tournament ON public.finance_entries(tournament_id);

-- ============= 3. Audit diff =============
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS diff jsonb;

CREATE OR REPLACE FUNCTION public.audit_finance_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row record; _action text; _entity text := TG_TABLE_NAME; _diff jsonb;
BEGIN
  _row := COALESCE(NEW, OLD);
  _action := CASE TG_OP WHEN 'INSERT' THEN upper(_entity)||'_CREATED'
                        WHEN 'UPDATE' THEN upper(_entity)||'_UPDATED'
                        ELSE upper(_entity)||'_DELETED' END;
  _diff := jsonb_build_object(
    'before', CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    'after',  CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description, diff)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action, _entity, _row.id::text,
    COALESCE(NEW.name, NEW.title, OLD.name, OLD.title, _row.id::text), _diff);
  RETURN _row;
END $$;

DROP TRIGGER IF EXISTS audit_finance_entries ON public.finance_entries;
CREATE TRIGGER audit_finance_entries AFTER INSERT OR UPDATE OR DELETE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_finance_changes();
DROP TRIGGER IF EXISTS audit_finance_categories ON public.finance_categories;
CREATE TRIGGER audit_finance_categories AFTER INSERT OR UPDATE OR DELETE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.audit_finance_changes();
DROP TRIGGER IF EXISTS audit_finance_tags ON public.finance_tags;
CREATE TRIGGER audit_finance_tags AFTER INSERT OR UPDATE OR DELETE ON public.finance_tags
  FOR EACH ROW EXECUTE FUNCTION public.audit_finance_changes();

-- ============= 4. Feed: índices =============
CREATE INDEX IF NOT EXISTS idx_member_feed_posts_created ON public.member_feed_posts(created_at DESC) WHERE status <> 'deleted';
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON public.post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read_at, created_at DESC);

-- ============= 5. Post comments: edição + admin delete =============
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "post_comments_update_own" ON public.post_comments;
CREATE POLICY "post_comments_update_own" ON public.post_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "post_comments_admin_delete" ON public.post_comments;
CREATE POLICY "post_comments_admin_delete" ON public.post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

-- ============= 6. Notificações de curtida e comentário =============
CREATE OR REPLACE FUNCTION public.notify_post_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _author uuid; _actor text;
BEGIN
  SELECT author_id INTO _author FROM public.member_feed_posts WHERE id = NEW.post_id;
  IF _author IS NULL OR _author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, email, 'alguém') INTO _actor FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_author, 'post_like', _actor || ' curtiu seu post', NULL, '/dashboard/feed');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_reaction ON public.post_reactions;
CREATE TRIGGER trg_notify_reaction AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_reaction();

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _author uuid; _actor text;
BEGIN
  SELECT author_id INTO _author FROM public.member_feed_posts WHERE id = NEW.post_id;
  IF _author IS NULL OR _author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, email, 'alguém') INTO _actor FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_author, 'post_comment', _actor || ' comentou seu post', LEFT(NEW.content,120), '/dashboard/feed');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_comment ON public.post_comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- ============= 7. Sync email profile <-> auth.users =============
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email, updated_at = now() WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- ============= 8. Perfil público helper =============
CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'followers', (SELECT count(*) FROM public.user_follows WHERE following_id = p.user_id),
    'following', (SELECT count(*) FROM public.user_follows WHERE follower_id = p.user_id),
    'posts', (SELECT count(*) FROM public.member_feed_posts WHERE author_id = p.user_id AND status <> 'deleted')
  )
  FROM public.profiles p WHERE p.user_id = _user_id AND p.is_blocked = false
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;
