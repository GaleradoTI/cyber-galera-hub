UPDATE public.ambassador_permissions p SET areas = p.areas || ARRAY(SELECT a || ':' || act FROM unnest(p.areas) a CROSS JOIN unnest(ARRAY['criar','editar','publicar','aprovar','remover']) act WHERE a NOT LIKE '%:%');
CREATE OR REPLACE FUNCTION public.has_ambassador_permission(_user_id uuid, _area text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(_user_id,'EMBAIXADOR'::public.app_role) AND EXISTS(SELECT 1 FROM public.ambassador_permissions p WHERE p.user_id=_user_id AND (_area=ANY(p.areas) OR (strpos(_area,':')=0 AND EXISTS(SELECT 1 FROM unnest(p.areas) a WHERE a LIKE _area || ':%')))) $$;
REVOKE ALL ON FUNCTION public.has_ambassador_permission(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.has_ambassador_permission(uuid,text) TO authenticated,service_role;
DO $$ DECLARE p record; q text; w text; area text; action text; BEGIN FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'Ambassador%' AND cmd<>'SELECT' LOOP
 area := CASE p.tablename WHEN 'events' THEN 'eventos' WHEN 'jobs' THEN 'vagas' WHEN 'partners' THEN 'parceiros' WHEN 'faqs' THEN 'faqs' WHEN 'testimonials' THEN 'depoimentos' WHEN 'reports' THEN 'denuncias' END;
 IF area IS NOT NULL THEN
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 IF p.cmd='ALL' THEN
 EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(),%L))',p.policyname || ' read',p.tablename,area);
 EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_ambassador_permission(auth.uid(),%L))',p.policyname || ' create',p.tablename,area || ':criar');
 EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_ambassador_permission(auth.uid(),%L)) WITH CHECK (public.has_ambassador_permission(auth.uid(),%L))',p.policyname || ' edit',p.tablename,area || ':editar',area || ':editar');
 EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_ambassador_permission(auth.uid(),%L))',p.policyname || ' delete',p.tablename,area || ':remover');
 ELSE
 action:= CASE p.cmd WHEN 'INSERT' THEN 'criar' WHEN 'DELETE' THEN 'remover' ELSE CASE WHEN area IN ('depoimentos','denuncias') THEN 'aprovar' ELSE 'editar' END END;
 q:=format('public.has_ambassador_permission(auth.uid(),%L)',area || ':' || action);
 IF p.cmd='UPDATE' AND area IN ('eventos','vagas') THEN q:=q || format(' OR public.has_ambassador_permission(auth.uid(),%L) OR public.has_ambassador_permission(auth.uid(),%L)',area || ':publicar',area || ':aprovar'); END IF;
 EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s',p.policyname,p.tablename,p.cmd,CASE WHEN p.cmd='INSERT' THEN 'WITH CHECK (' || q || ')' WHEN p.cmd='DELETE' THEN 'USING (' || q || ')' ELSE 'USING (' || q || ') WITH CHECK (' || q || ')' END);
 END IF; END IF; END LOOP; END $$;
DROP POLICY "Ambassador moderates feed" ON public.member_feed_posts;
DROP POLICY "Ambassador news insert" ON public.member_feed_posts;
DROP POLICY "Only admins create news" ON public.member_feed_posts;
DROP POLICY "Only admins edit news" ON public.member_feed_posts;
ALTER POLICY "Members create own feed posts" ON public.member_feed_posts WITH CHECK (author_id=auth.uid() AND status='published' AND kind<>'news');
ALTER POLICY "Members edit own feed posts" ON public.member_feed_posts USING ((author_id=auth.uid() AND kind<>'news') OR public.is_admin_or_super(auth.uid())) WITH CHECK ((author_id=auth.uid() AND kind<>'news' AND status IN ('published','deleted')) OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "News create authorized" ON public.member_feed_posts FOR INSERT TO authenticated WITH CHECK (kind='news' AND author_id=auth.uid() AND (public.is_admin_or_super(auth.uid()) OR public.has_ambassador_permission(auth.uid(),'noticias:criar')));
CREATE POLICY "News update authorized" ON public.member_feed_posts FOR UPDATE TO authenticated USING ((kind='news' AND (public.has_ambassador_permission(auth.uid(),'noticias:editar') OR public.has_ambassador_permission(auth.uid(),'noticias:publicar'))) OR (kind<>'news' AND public.has_ambassador_permission(auth.uid(),'feed:aprovar'))) WITH CHECK ((kind='news' AND (public.has_ambassador_permission(auth.uid(),'noticias:editar') OR public.has_ambassador_permission(auth.uid(),'noticias:publicar'))) OR (kind<>'news' AND public.has_ambassador_permission(auth.uid(),'feed:aprovar')));
CREATE POLICY "News delete authorized" ON public.member_feed_posts FOR DELETE TO authenticated USING (kind='news' AND public.has_ambassador_permission(auth.uid(),'noticias:remover'));
CREATE OR REPLACE FUNCTION public.guard_ambassador_content_action() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE area text; n jsonb; o jsonb; action text; BEGIN
 IF auth.uid() IS NULL OR public.is_admin_or_super(auth.uid()) THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_TABLE_NAME='member_feed_posts' THEN
 IF TG_OP='UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind THEN RAISE EXCEPTION 'Não é permitido alterar o tipo do conteúdo'; END IF;
 IF (TG_OP='DELETE' AND OLD.kind<>'news') OR (TG_OP<>'DELETE' AND NEW.kind<>'news') THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 area:='noticias'; ELSE area:=CASE TG_TABLE_NAME WHEN 'jobs' THEN 'vagas' ELSE 'eventos' END; END IF;
 IF NOT public.has_role(auth.uid(),'EMBAIXADOR') AND area<>'noticias' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN IF NOT public.has_ambassador_permission(auth.uid(),area || ':remover') THEN RAISE EXCEPTION 'Sem acesso para remover'; END IF; RETURN OLD; END IF;
 n:=to_jsonb(NEW);
 IF TG_OP='INSERT' THEN
 IF NOT public.has_ambassador_permission(auth.uid(),area || ':criar') THEN RAISE EXCEPTION 'Sem acesso para criar'; END IF;
 IF n->>'status' IN ('published','publicado') AND NOT public.has_ambassador_permission(auth.uid(),area || ':publicar') THEN RAISE EXCEPTION 'Sem acesso para publicar; salve como rascunho'; END IF;
 ELSE o:=to_jsonb(OLD);
 IF (n - ARRAY['status','approval_status','approved_by','approved_at','updated_at']) IS DISTINCT FROM (o - ARRAY['status','approval_status','approved_by','approved_at','updated_at']) AND NOT public.has_ambassador_permission(auth.uid(),area || ':editar') THEN RAISE EXCEPTION 'Sem acesso para editar'; END IF;
 IF n->>'status' IS DISTINCT FROM o->>'status' AND NOT public.has_ambassador_permission(auth.uid(),area || ':publicar') THEN RAISE EXCEPTION 'Sem acesso para publicar ou despublicar'; END IF;
 IF n->>'approval_status' IS DISTINCT FROM o->>'approval_status' AND NOT public.has_ambassador_permission(auth.uid(),area || ':aprovar') THEN RAISE EXCEPTION 'Sem acesso para aprovar'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER z_guard_ambassador_actions BEFORE INSERT OR UPDATE OR DELETE ON public.events FOR EACH ROW EXECUTE FUNCTION public.guard_ambassador_content_action();
CREATE TRIGGER z_guard_ambassador_actions BEFORE INSERT OR UPDATE OR DELETE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_ambassador_content_action();
CREATE TRIGGER z_guard_ambassador_actions BEFORE INSERT OR UPDATE OR DELETE ON public.member_feed_posts FOR EACH ROW EXECUTE FUNCTION public.guard_ambassador_content_action();
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='events_submission_guard'; definition:=replace(definition,'IF NOT public.is_admin_or_super(auth.uid()) THEN','IF NOT (public.is_admin_or_super(auth.uid()) OR public.has_ambassador_permission(auth.uid(),''eventos:aprovar'')) THEN'); EXECUTE definition; END $$;
CREATE POLICY "Event staff read registrations" ON public.event_registrations FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(),'eventos:inscricoes') OR public.has_ambassador_permission(auth.uid(),'eventos:checkin'));
CREATE POLICY "Event staff read attendance" ON public.event_checkins FOR SELECT TO authenticated USING (public.has_ambassador_permission(auth.uid(),'eventos:inscricoes') OR public.has_ambassador_permission(auth.uid(),'eventos:checkin'));
ALTER POLICY "checkin_self_insert" ON public.event_checkins WITH CHECK (public.is_admin_or_super(auth.uid()));
ALTER POLICY "checkin_self_delete" ON public.event_checkins USING (public.is_admin_or_super(auth.uid()));
CREATE OR REPLACE FUNCTION public.checkin_by_code(_code text,_event_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.event_registrations; p public.profiles; uid uuid:=auth.uid(); already boolean; BEGIN
 IF NOT (public.is_admin_or_super(uid) OR public.has_ambassador_permission(uid,'eventos:checkin')) THEN RAISE EXCEPTION 'Sem acesso para confirmar presença'; END IF;
 SELECT * INTO r FROM public.event_registrations WHERE ticket_code=upper(trim(_code)) AND event_id=_event_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('result','not_found'); END IF;
 SELECT * INTO p FROM public.profiles WHERE user_id=r.user_id;
 IF r.status<>'approved' THEN RETURN jsonb_build_object('result','not_approved','name',p.display_name); END IF;
 already:=r.checked_in_at IS NOT NULL;
 IF NOT already THEN
 UPDATE public.event_registrations SET checked_in_at=now(),checked_in_by=uid WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.event_checkins(event_id,user_id,source) VALUES(r.event_id,r.user_id,'qrcode') ON CONFLICT DO NOTHING;
 INSERT INTO public.notifications(user_id,type,title,body,link) VALUES(r.user_id,'event_registration','Presença registrada', 'Seu check-in foi confirmado. Seu ingresso está no perfil.', '/dashboard/perfil');
 END IF;
 RETURN jsonb_build_object('result',CASE WHEN already THEN 'already' ELSE 'ok' END,'name',p.display_name,'avatar_url',p.avatar_url,'work_area',p.work_area,'checked_in_at',r.checked_in_at);
 END $$;
CREATE OR REPLACE FUNCTION public.decide_registration(_ids uuid[],_status text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid:=auth.uid(); n integer; BEGIN
 IF NOT(public.is_admin_or_super(uid) OR public.has_ambassador_permission(uid,'eventos:inscricoes')) THEN RAISE EXCEPTION 'Sem acesso para aprovar inscrições'; END IF;
 IF _status NOT IN ('approved','rejected','pending','waitlist') THEN RAISE EXCEPTION 'Status inválido'; END IF;
 UPDATE public.event_registrations SET status=_status,decided_by=uid,decided_at=now() WHERE id=ANY(_ids) AND checked_in_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO public.audit_logs(user_id,user_name,action,entity,description) VALUES(uid,public._audit_actor_name(uid),'decide_registration','event_registration',_status || ' x' || n); RETURN n; END $$;
REVOKE ALL ON FUNCTION public.guard_ambassador_content_action() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.checkin_by_code(text,uuid),public.decide_registration(uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checkin_by_code(text,uuid),public.decide_registration(uuid[],text) TO authenticated,service_role;