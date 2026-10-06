-- Feed reactions/comments: visible only when the parent post is visible to the caller
DROP POLICY IF EXISTS "Membros veem reações do feed" ON public.feed_post_reactions;
CREATE POLICY "Membros veem reações de posts visíveis" ON public.feed_post_reactions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.member_feed_posts p WHERE p.id = post_id));

DROP POLICY IF EXISTS "Membros leem comentários do feed" ON public.feed_post_comments;
CREATE POLICY "Membros leem comentários de posts visíveis" ON public.feed_post_comments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.member_feed_posts p WHERE p.id = post_id));

DROP POLICY IF EXISTS "Membros veem curtidas de comentários" ON public.feed_comment_reactions;
CREATE POLICY "Membros veem curtidas de comentários visíveis" ON public.feed_comment_reactions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.feed_post_comments c WHERE c.id = comment_id));

-- Follows: only active (non-blocked) members can see the follow graph, plus own rows
DROP POLICY IF EXISTS "Authenticated read follows" ON public.user_follows;
CREATE POLICY "Membros ativos veem seguidores" ON public.user_follows
FOR SELECT TO authenticated
USING (
  follower_id = auth.uid() OR following_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid() AND pr.is_blocked = false)
);

-- Badges: own badges, or active members viewing badges
DROP POLICY IF EXISTS "Badges visíveis para autenticados" ON public.member_badges;
CREATE POLICY "Badges visíveis para membros ativos" ON public.member_badges
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid() AND pr.is_blocked = false)
);

-- Tournaments: finance metadata, admins only
DROP POLICY IF EXISTS "tournaments_read_auth" ON public.tournaments;
CREATE POLICY "tournaments_read_admin" ON public.tournaments
FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- Home stats: single aggregate row only
DROP POLICY IF EXISTS "Public reads home stats" ON public.public_home_stats;
CREATE POLICY "Public reads home stats singleton" ON public.public_home_stats
FOR SELECT TO anon, authenticated
USING (id = true);

-- Storage: public files stay reachable by public URL; listing limited to owner/admin
DROP POLICY IF EXISTS "Storage leitura pública para buckets públicos" ON storage.objects;
CREATE POLICY "Storage listagem pelo dono ou admin" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = ANY (ARRAY['avatars','project-covers'])
  AND (owner_id = (auth.uid())::text OR public.is_admin_or_super(auth.uid()))
);