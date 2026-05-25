
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MEMBRO');
CREATE TYPE public.content_status AS ENUM ('rascunho', 'publicado', 'pausado', 'encerrado');
CREATE TYPE public.seniority_level AS ENUM ('estagio', 'junior', 'pleno', 'senior', 'especialista');
CREATE TYPE public.work_modality AS ENUM ('remoto', 'hibrido', 'presencial');
CREATE TYPE public.event_modality AS ENUM ('online', 'presencial', 'hibrido');

-- =========================================================
-- TRIGGER: updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  newsletter_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (tabela separada — segurança)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
$$;

-- =========================================================
-- handle_new_user: cria profile + role MEMBRO automaticamente
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, newsletter_opt_in)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'newsletter_opt_in')::boolean, false)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'MEMBRO');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- JOBS
-- =========================================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  seniority seniority_level NOT NULL,
  modality work_modality NOT NULL,
  location TEXT,
  technologies TEXT[] NOT NULL DEFAULT '{}',
  apply_url TEXT,
  status content_status NOT NULL DEFAULT 'rascunho',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);

-- =========================================================
-- EVENTS
-- =========================================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  modality event_modality NOT NULL,
  location_or_link TEXT,
  status content_status NOT NULL DEFAULT 'rascunho',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_date ON public.events(event_date);

-- =========================================================
-- CHANNELS
-- =========================================================
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Link',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_channels_updated BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- FAQS
-- =========================================================
CREATE TABLE public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_faqs_updated BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PUBLIC SITE SETTINGS (key/value para editor do site)
-- =========================================================
CREATE TABLE public.public_site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.public_site_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.public_site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SAVED JOBS / EVENT INTERESTS
-- =========================================================
CREATE TABLE public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_event_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
ALTER TABLE public.user_event_interests ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- LGPD CONSENTS
-- =========================================================
CREATE TABLE public.lgpd_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_policy_version TEXT NOT NULL,
  consent_status BOOLEAN NOT NULL DEFAULT true,
  consent_origin TEXT NOT NULL DEFAULT 'signup',
  ip_address TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lgpd_user ON public.lgpd_consents(user_id, accepted_at DESC);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  role app_role,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
CREATE POLICY "Profiles visible to everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Only super admin manages roles - insert" ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));
CREATE POLICY "Only super admin manages roles - update" ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));
CREATE POLICY "Only super admin manages roles - delete" ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- jobs
CREATE POLICY "Published jobs are public" ON public.jobs FOR SELECT
  USING (status = 'publicado' OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage jobs - insert" ON public.jobs FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage jobs - update" ON public.jobs FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage jobs - delete" ON public.jobs FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- events
CREATE POLICY "Published events are public" ON public.events FOR SELECT
  USING (status = 'publicado' OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage events - insert" ON public.events FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage events - update" ON public.events FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage events - delete" ON public.events FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- channels
CREATE POLICY "Active channels are public" ON public.channels FOR SELECT
  USING (is_active = true OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage channels - insert" ON public.channels FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage channels - update" ON public.channels FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage channels - delete" ON public.channels FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- faqs
CREATE POLICY "Active FAQs are public" ON public.faqs FOR SELECT
  USING (is_active = true OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage faqs - insert" ON public.faqs FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage faqs - update" ON public.faqs FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage faqs - delete" ON public.faqs FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

-- public_site_settings
CREATE POLICY "Settings are public" ON public.public_site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings - insert" ON public.public_site_settings FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage settings - update" ON public.public_site_settings FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));

-- saved_jobs
CREATE POLICY "Users manage own saved jobs - select" ON public.saved_jobs FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own saved jobs - insert" ON public.saved_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own saved jobs - delete" ON public.saved_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- user_event_interests
CREATE POLICY "Users manage own interests - select" ON public.user_event_interests FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own interests - insert" ON public.user_event_interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own interests - delete" ON public.user_event_interests FOR DELETE
  USING (auth.uid() = user_id);

-- lgpd_consents
CREATE POLICY "Users view own consents" ON public.lgpd_consents FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users insert own consents" ON public.lgpd_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- audit_logs
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Authenticated users insert audit logs" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- SEEDS
-- =========================================================
INSERT INTO public.channels (name, slug, description, url, icon_name, display_order) VALUES
  ('WhatsApp', 'whatsapp', 'Comunidade principal no WhatsApp para conversas rápidas e networking.', 'https://chat.whatsapp.com/', 'MessageCircle', 1),
  ('Discord', 'discord', 'Servidor oficial com canais por tecnologia, áreas e estudos.', 'https://discord.gg/', 'Hash', 2),
  ('LinkedIn', 'linkedin', 'Conecte-se com profissionais e fique por dentro das vagas.', 'https://linkedin.com/', 'Linkedin', 3),
  ('Instagram', 'instagram', 'Conteúdo visual, eventos e bastidores da comunidade.', 'https://instagram.com/', 'Instagram', 4),
  ('GitHub', 'github', 'Projetos open source mantidos pela galera.', 'https://github.com/', 'Github', 5),
  ('YouTube', 'youtube', 'Lives, tutoriais e talks gravadas dos eventos.', 'https://youtube.com/', 'Youtube', 6),
  ('Newsletter', 'newsletter', 'Resumo semanal direto no seu e-mail.', '#', 'Mail', 7);

INSERT INTO public.faqs (question, answer, category, display_order) VALUES
  ('O que é a GALERA DO T.I.?', 'Somos uma comunidade tech para networking, aprendizado e oportunidades na área de tecnologia.', 'Geral', 1),
  ('A comunidade é gratuita?', 'Sim! O acesso à comunidade e a todos os canais é 100% gratuito.', 'Geral', 2),
  ('Como divulgo uma vaga?', 'Recrutadores aprovados podem publicar vagas no painel administrativo após cadastro e validação.', 'Vagas', 3),
  ('Posso participar sendo iniciante?', 'Com certeza. Temos membros de todos os níveis, de estagiário a especialista.', 'Geral', 4),
  ('Como funcionam os eventos?', 'Publicamos meetups, workshops e lives. Confirme presença para receber lembretes.', 'Eventos', 5);

INSERT INTO public.jobs (title, company, description, short_description, seniority, modality, location, technologies, status) VALUES
  ('Desenvolvedor Full Stack', 'Tech Solutions', 'Vaga para desenvolvedor full stack com experiência em Node.js e React. Trabalhar em produto SaaS escalável.', 'Full Stack Node + React em produto SaaS.', 'pleno', 'remoto', 'Brasil', ARRAY['Node.js','React','TypeScript'], 'publicado'),
  ('DevOps Engineer', 'Cloud Company', 'Engenheiro DevOps sênior para liderar infraestrutura cloud em AWS com Kubernetes.', 'DevOps sênior AWS + Kubernetes.', 'senior', 'remoto', 'Brasil', ARRAY['AWS','Docker','Kubernetes','Terraform'], 'publicado'),
  ('Analista de Dados', 'Data Insights', 'Analista de dados pleno para construir dashboards e pipelines de ETL.', 'Dashboards e ETL com Python e SQL.', 'pleno', 'hibrido', 'São Paulo, SP', ARRAY['Python','SQL','Power BI'], 'publicado'),
  ('Engenheiro de Software Backend', 'FintechX', 'Backend Go para sistema financeiro de alta performance.', 'Backend Go em fintech.', 'senior', 'remoto', 'Brasil', ARRAY['Go','PostgreSQL','Redis'], 'publicado'),
  ('UX Designer', 'ProductLab', 'Designer UX pleno para conduzir pesquisas e protótipos.', 'UX research + prototipação.', 'pleno', 'hibrido', 'Rio de Janeiro, RJ', ARRAY['Figma','Pesquisa UX'], 'publicado');

INSERT INTO public.events (name, description, category, event_date, event_time, modality, location_or_link, status) VALUES
  ('Tech Meetup - Networking', 'Encontro mensal para networking entre devs e recrutadores.', 'Networking', CURRENT_DATE + INTERVAL '10 days', '19:00', 'online', 'https://meet.google.com/', 'publicado'),
  ('Workshop: Git & GitHub', 'Boas práticas e fluxos profissionais com Git.', 'Workshop', CURRENT_DATE + INTERVAL '20 days', '20:00', 'online', 'https://meet.google.com/', 'publicado'),
  ('Live: Carreira em Cloud', 'Painel com especialistas sobre carreira em Cloud Computing.', 'Live', CURRENT_DATE + INTERVAL '30 days', '20:30', 'online', 'https://youtube.com/', 'publicado');

INSERT INTO public.public_site_settings (setting_key, setting_value, description) VALUES
  ('hero', '{"title":"GALERA DO T.I.","subtitle":"Comunidade Tech • Networking • Carreira","slogan":"Se tem código, tem solução. Se não tem, a gente cria.","description":"A maior comunidade tech para networking, aprendizado, compartilhamento e oportunidades da área de tecnologia.","cta_primary":"Entrar na comunidade","cta_secondary":"Área do recrutador"}'::jsonb, 'Hero da home'),
  ('stats', '{"members":"500+","recruiters":"80+","jobs":"120+","events":"30+"}'::jsonb, 'Estatísticas da home'),
  ('about', '{"mission":"Conectar pessoas, gerar oportunidades e transformar carreiras na área de tecnologia.","vision":"Ser a maior e mais ativa comunidade tech do Brasil.","values":["Colaboração","Diversidade","Aprendizado contínuo","Transparência","Excelência técnica"]}'::jsonb, 'Página Sobre'),
  ('legal', '{"terms_version":"1.0","privacy_version":"1.0"}'::jsonb, 'Versões dos termos e política');
