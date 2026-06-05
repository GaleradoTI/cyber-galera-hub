
-- 1) Banner separado da capa
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS banner_url text;

-- 2) Regra: um usuário não pode estar em 2 squads do mesmo projeto
CREATE OR REPLACE FUNCTION public.prevent_dup_squad_per_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id uuid;
  _exists boolean;
BEGIN
  SELECT project_id INTO _project_id FROM public.squads WHERE id = NEW.squad_id;
  IF _project_id IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1
    FROM public.squad_members sm
    JOIN public.squads s ON s.id = sm.squad_id
    WHERE s.project_id = _project_id
      AND sm.user_id = NEW.user_id
      AND sm.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) INTO _exists;
  IF _exists THEN
    RAISE EXCEPTION 'Usuário já participa de outro squad deste projeto';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_dup_squad_per_project ON public.squad_members;
CREATE TRIGGER trg_prevent_dup_squad_per_project
BEFORE INSERT OR UPDATE ON public.squad_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_dup_squad_per_project();

-- 3) Depoimentos
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text NOT NULL CHECK (char_length(content) BETWEEN 10 AND 1000),
  role_title text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  moderator_id uuid,
  moderator_note text,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT SELECT ON public.testimonials TO anon;
GRANT ALL ON public.testimonials TO service_role;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Público (anon + auth) só vê aprovados
CREATE POLICY "Public read approved testimonials"
ON public.testimonials FOR SELECT
TO anon, authenticated
USING (status = 'approved');

-- Autor vê os próprios em qualquer status
CREATE POLICY "Authors view own testimonials"
ON public.testimonials FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins veem todos
CREATE POLICY "Admins view all testimonials"
ON public.testimonials FOR SELECT
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- Autor insere o próprio (status forçado por trigger abaixo)
CREATE POLICY "Authors insert own testimonials"
ON public.testimonials FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Autor edita o próprio enquanto pendente
CREATE POLICY "Authors update own pending"
ON public.testimonials FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id);

-- Admin modera (atualiza qualquer)
CREATE POLICY "Admins moderate testimonials"
ON public.testimonials FOR UPDATE
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- Autor remove o próprio
CREATE POLICY "Authors delete own testimonials"
ON public.testimonials FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admin remove qualquer
CREATE POLICY "Admins delete testimonials"
ON public.testimonials FOR DELETE
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- Trigger: força status pending no insert (a menos que admin)
-- e bloqueia o autor de mudar status próprio
CREATE OR REPLACE FUNCTION public.testimonials_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin_or_super(auth.uid()) THEN
      NEW.status := 'pending';
      NEW.moderator_id := NULL;
      NEW.moderator_note := NULL;
      NEW.moderated_at := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT public.is_admin_or_super(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar status do depoimento';
      END IF;
      NEW.moderator_id := auth.uid();
      NEW.moderated_at := now();
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_testimonials_guard ON public.testimonials;
CREATE TRIGGER trg_testimonials_guard
BEFORE INSERT OR UPDATE ON public.testimonials
FOR EACH ROW EXECUTE FUNCTION public.testimonials_guard();

CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_user ON public.testimonials(user_id);
