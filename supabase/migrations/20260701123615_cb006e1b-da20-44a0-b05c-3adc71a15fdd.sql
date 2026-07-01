-- Fix audit trigger functions: profiles has no full_name column
CREATE OR REPLACE FUNCTION public.audit_community_profiles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_name text;
  action_name text;
BEGIN
  SELECT COALESCE(display_name, email) INTO actor_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN action_name := 'COMMUNITY_PROFILE_CREATED';
  ELSIF TG_OP = 'UPDATE' THEN action_name := 'COMMUNITY_PROFILE_UPDATED';
  ELSE action_name := 'COMMUNITY_PROFILE_DELETED';
  END IF;

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (
    auth.uid(),
    actor_name,
    action_name,
    'community_profiles',
    COALESCE(NEW.id, OLD.id)::text,
    COALESCE(NEW.profile_type, OLD.profile_type) || ': ' || COALESCE(NEW.name, OLD.name)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_member_feed_posts_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_name text;
  action_name text;
BEGIN
  SELECT COALESCE(display_name, email) INTO actor_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN action_name := 'FEED_POST_CREATED';
  ELSIF TG_OP = 'UPDATE' THEN action_name := 'FEED_POST_UPDATED';
  ELSE action_name := 'FEED_POST_DELETED';
  END IF;

  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (
    auth.uid(),
    actor_name,
    action_name,
    'member_feed_posts',
    COALESCE(NEW.id, OLD.id)::text,
    'Post do feed atualizado'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;