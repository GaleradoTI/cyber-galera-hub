
-- 1. Enum: adiciona EMBAIXADOR
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'EMBAIXADOR';

-- 2. Nova tabela: drop_variants
CREATE TABLE IF NOT EXISTS public.drop_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  name text NOT NULL,
  material text,
  price_cents integer,
  available_sizes text[] NOT NULL DEFAULT '{}',
  size_measurements jsonb NOT NULL DEFAULT '{}'::jsonb,
  images text[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.drop_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drop_variants TO authenticated;
GRANT ALL ON public.drop_variants TO service_role;

ALTER TABLE public.drop_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drop_variants public read published"
ON public.drop_variants FOR SELECT
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.drops d
    WHERE d.id = drop_variants.drop_id AND d.status = 'published'
  )
);

CREATE POLICY "drop_variants admin read all"
ON public.drop_variants FOR SELECT
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "drop_variants admin insert"
ON public.drop_variants FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "drop_variants admin update"
ON public.drop_variants FOR UPDATE
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "drop_variants admin delete"
ON public.drop_variants FOR DELETE
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER drop_variants_updated_at
BEFORE UPDATE ON public.drop_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Audit trigger for variants
CREATE OR REPLACE FUNCTION public.log_drop_variant_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _row record; _action text; _title text;
BEGIN
  _row := COALESCE(NEW, OLD);
  SELECT title INTO _title FROM public.drops WHERE id = _row.drop_id;
  IF TG_OP = 'INSERT' THEN _action := 'DROP_VARIANT_CREATED';
  ELSIF TG_OP = 'DELETE' THEN _action := 'DROP_VARIANT_DELETED';
  ELSE _action := 'DROP_VARIANT_UPDATED';
  END IF;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()), _action, 'drop_variants', _row.id::text,
    'Variante "' || _row.name || '" do drop "' || COALESCE(_title, _row.drop_id::text) || '"');
  RETURN _row;
END $$;

CREATE TRIGGER drop_variants_audit
AFTER INSERT OR UPDATE OR DELETE ON public.drop_variants
FOR EACH ROW EXECUTE FUNCTION public.log_drop_variant_changes();

-- 4. drop_interests: variant_id + admin CRUD
ALTER TABLE public.drop_interests
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.drop_variants(id) ON DELETE SET NULL;

-- Admin pode INSERT/DELETE manual
DROP POLICY IF EXISTS "drop_interests admin insert" ON public.drop_interests;
CREATE POLICY "drop_interests admin insert"
ON public.drop_interests FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "drop_interests admin delete" ON public.drop_interests;
CREATE POLICY "drop_interests admin delete"
ON public.drop_interests FOR DELETE
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- Log de exclusão
CREATE OR REPLACE FUNCTION public.log_drop_interest_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _title text;
BEGIN
  SELECT title INTO _title FROM public.drops WHERE id = OLD.drop_id;
  INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
  VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
    'DROP_INTEREST_DELETED', 'drop_interests', OLD.id::text,
    'Excluiu pedido de ' || OLD.full_name || ' no drop "' || COALESCE(_title, OLD.drop_id::text) || '"');
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS drop_interests_delete_audit ON public.drop_interests;
CREATE TRIGGER drop_interests_delete_audit
AFTER DELETE ON public.drop_interests
FOR EACH ROW EXECUTE FUNCTION public.log_drop_interest_delete();

-- 5. community_profiles link audit
CREATE OR REPLACE FUNCTION public.log_community_profile_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    INSERT INTO public.audit_logs(user_id, user_name, action, entity, entity_id, description)
    VALUES (auth.uid(), public._audit_actor_name(auth.uid()),
      CASE WHEN NEW.user_id IS NULL THEN 'COMMUNITY_PROFILE_UNLINKED' ELSE 'COMMUNITY_PROFILE_LINKED' END,
      'community_profiles', NEW.id::text,
      'Perfil "' || NEW.name || '" ' ||
      CASE WHEN NEW.user_id IS NULL THEN 'desvinculado do usuário ' || COALESCE(OLD.user_id::text,'—')
           ELSE 'vinculado ao usuário ' || COALESCE(public._audit_actor_name(NEW.user_id), NEW.user_id::text) END);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS community_profiles_link_audit ON public.community_profiles;
CREATE TRIGGER community_profiles_link_audit
AFTER UPDATE OF user_id ON public.community_profiles
FOR EACH ROW EXECUTE FUNCTION public.log_community_profile_link();
