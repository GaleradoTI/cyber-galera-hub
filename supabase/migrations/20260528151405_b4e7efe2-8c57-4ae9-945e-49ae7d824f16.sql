-- Fix missing SELECT/UPDATE policies on projects
CREATE POLICY "Admins e membros veem projetos"
ON public.projects FOR SELECT
USING (
  is_admin_or_super(auth.uid())
  OR is_project_member(auth.uid(), id)
);

CREATE POLICY "Admins atualizam projetos"
ON public.projects FOR UPDATE
USING (is_admin_or_super(auth.uid()));

-- Trigger to keep updated_at fresh
CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER squads_set_updated_at
BEFORE UPDATE ON public.squads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER project_posts_set_updated_at
BEFORE UPDATE ON public.project_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
