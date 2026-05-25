
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_site_settings_setting_key_key') THEN
    ALTER TABLE public.public_site_settings ADD CONSTRAINT public_site_settings_setting_key_key UNIQUE (setting_key);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

INSERT INTO public.jobs (title, company, short_description, description, seniority, modality, location, technologies, apply_url, status)
SELECT * FROM (VALUES
  ('Desenvolvedor Full Stack Pleno', 'Neon Labs', 'Atuar em produto SaaS B2B com React + Node.', 'Buscamos pessoa Pleno para liderar features end-to-end em produto consolidado.', 'pleno'::seniority_level, 'remoto'::work_modality, 'Brasil', ARRAY['React','TypeScript','Node.js','PostgreSQL'], 'https://example.com/vaga1', 'publicado'::content_status),
  ('DevOps Engineer Sênior', 'CloudByte', 'Infra como código, observabilidade e CI/CD em escala.', 'Responsável por evoluir plataforma multi-cloud, Kubernetes e pipelines GitOps.', 'senior', 'hibrido', 'São Paulo, SP', ARRAY['AWS','Terraform','Kubernetes','GitHub Actions'], 'https://example.com/vaga2', 'publicado'),
  ('Estágio em Desenvolvimento Web', 'StartupX', 'Primeira experiência com mentoria estruturada.', 'Programa de estágio remoto com trilha de aprendizado e projetos reais.', 'estagio', 'remoto', 'Brasil', ARRAY['HTML','CSS','JavaScript','React'], 'https://example.com/vaga3', 'publicado'),
  ('Engenheiro de Dados Pleno', 'DataForge', 'Pipelines em Airflow e modelagem em dbt.', 'Construção de data products, governança e qualidade.', 'pleno', 'remoto', 'Brasil', ARRAY['Python','Airflow','dbt','Snowflake'], 'https://example.com/vaga4', 'publicado'),
  ('Mobile Developer Júnior (Flutter)', 'AppCraft', 'Desenvolvimento de apps multiplataforma.', 'Trabalhar em produto consumer com milhões de downloads.', 'junior', 'presencial', 'Florianópolis, SC', ARRAY['Flutter','Dart','Firebase'], 'https://example.com/vaga5', 'publicado'),
  ('Especialista em Segurança Ofensiva', 'RedTeam Security', 'Pentests, red team e relatórios técnicos.', 'Atuação em projetos para grandes contas. Certificações desejáveis: OSCP, CRTO.', 'especialista', 'remoto', 'Brasil', ARRAY['Pentest','Burp Suite','Python','Linux'], 'https://example.com/vaga6', 'publicado'),
  ('Tech Lead Backend', 'FintechHub', 'Liderar squad de 6 pessoas, arquitetura distribuída.', 'Responsável pela evolução do core financeiro em microsserviços.', 'especialista', 'hibrido', 'São Paulo, SP', ARRAY['Go','Kafka','PostgreSQL','gRPC'], 'https://example.com/vaga7', 'publicado'),
  ('QA Automation Pleno', 'TestLab', 'Automação e2e em Playwright + estratégia de testes.', 'Trabalhar lado a lado com devs e PMs, evoluindo a qualidade do produto.', 'pleno', 'remoto', 'Brasil', ARRAY['Playwright','TypeScript','CI/CD'], 'https://example.com/vaga8', 'publicado')
) AS v(title, company, short_description, description, seniority, modality, location, technologies, apply_url, status)
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE jobs.title = v.title AND jobs.company = v.company);

INSERT INTO public.events (name, category, description, event_date, event_time, modality, location_or_link, status)
SELECT * FROM (VALUES
  ('Live: Carreira em Cloud em 2026', 'Carreira', 'Conversa aberta sobre certificações, mercado e salários em cloud.', CURRENT_DATE + INTERVAL '7 days', TIME '20:00', 'online'::event_modality, 'https://youtube.com/@galeradoti/live', 'publicado'::content_status),
  ('Meetup Galera do T.I. — São Paulo', 'Networking', 'Encontro presencial com talks de IA, segurança e DevOps.', CURRENT_DATE + INTERVAL '14 days', TIME '19:00', 'presencial', 'WeWork Paulista, São Paulo - SP', 'publicado'),
  ('Workshop: Construindo APIs com TanStack Start', 'Workshop', 'Mão na massa de 3h criando uma API full-stack.', CURRENT_DATE + INTERVAL '21 days', TIME '14:00', 'online', 'https://meet.example.com/tanstack', 'publicado'),
  ('Hackathon Comunidade — Edição Cyber', 'Hackathon', '48h de código com mentoria e premiação.', CURRENT_DATE + INTERVAL '30 days', TIME '09:00', 'hibrido', 'Online + Hub Inovação RJ', 'publicado'),
  ('Roda de Conversa: Mulheres em TI', 'Inclusão', 'Bate-papo sobre carreira, desafios e oportunidades.', CURRENT_DATE + INTERVAL '10 days', TIME '20:30', 'online', 'https://discord.gg/galeradoti', 'publicado'),
  ('Bootcamp Express: Fundamentos de IA', 'Educação', '4 encontros ao vivo sobre LLMs, RAG e agentes.', CURRENT_DATE + INTERVAL '45 days', TIME '19:30', 'online', 'https://meet.example.com/ia-bootcamp', 'publicado')
) AS v(name, category, description, event_date, event_time, modality, location_or_link, status)
WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE events.name = v.name);

INSERT INTO public.faqs (question, answer, category, display_order, is_active)
SELECT * FROM (VALUES
  ('O que é a GALERA DO T.I.?', 'Somos uma comunidade brasileira de profissionais e entusiastas de tecnologia que se conectam para trocar conhecimento, oportunidades e fazer networking.', 'Geral', 1, true),
  ('A comunidade é gratuita?', 'Sim. Todos os canais e eventos abertos são 100% gratuitos.', 'Geral', 2, true),
  ('Como entro nos canais oficiais?', 'Acesse a página /canais e clique no canal de sua preferência.', 'Acesso', 3, true),
  ('Como divulgo uma vaga?', 'Faça login e entre em contato com a curadoria pelo e-mail da página de contato. Toda vaga passa por moderação.', 'Vagas', 4, true),
  ('Posso propor um evento ou palestra?', 'Sim! Mande sua proposta para a curadoria e avaliaremos formato, data e público.', 'Eventos', 5, true),
  ('Vocês oferecem mentoria?', 'Temos rodas de mentoria recorrentes no Discord, abertas a membros cadastrados.', 'Mentoria', 6, true),
  ('Como funciona a moderação?', 'Seguimos um código de conduta público (página /termos). Violações podem resultar em bloqueio.', 'Comunidade', 7, true),
  ('Como exerço meus direitos pela LGPD?', 'Veja a página /privacidade. Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento.', 'Privacidade', 8, true)
) AS v(question, answer, category, display_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.faqs WHERE faqs.question = v.question);

INSERT INTO public.public_site_settings (setting_key, setting_value, description) VALUES
  ('hero', '{"headline":"Se tem código, tem solução.","subheadline":"A maior comunidade tech do Brasil para networking, carreira e oportunidades."}'::jsonb, 'Conteúdo do hero da home'),
  ('contact', '{"email":"contato@galeradoti.com.br","support":"suporte@galeradoti.com.br"}'::jsonb, 'E-mails de contato'),
  ('social_links', '{"instagram":"https://instagram.com/galeradoti","twitter":"https://twitter.com/galeradoti","linkedin":"https://linkedin.com/company/galeradoti"}'::jsonb, 'Links de redes sociais'),
  ('stats', '{"members":"12.4k","jobs_posted":"380","events_held":"96","channels":"6"}'::jsonb, 'Números exibidos na home')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.promote_user_to_super_admin(_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE email = _email LIMIT 1;
  IF _user_id IS NULL THEN
    RETURN 'Usuário não encontrado: ' || _email;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'SUPER_ADMIN')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'Usuário ' || _email || ' promovido para SUPER_ADMIN';
END;
$$;
