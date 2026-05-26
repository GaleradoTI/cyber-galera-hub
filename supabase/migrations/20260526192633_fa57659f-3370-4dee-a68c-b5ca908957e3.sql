
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS looking_for_job boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS work_area text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.public_site_settings (setting_key, setting_value, description) VALUES
  ('footer', '{"tagline":"Comunidade tech brasileira","copyright":"© GALERA DO T.I."}'::jsonb, 'Textos do rodapé'),
  ('seo', '{"default_title":"GALERA DO T.I.","default_description":"Comunidade tech brasileira para networking, vagas e eventos.","keywords":"tech, vagas, eventos, comunidade"}'::jsonb, 'SEO global'),
  ('newsletter', '{"enabled":true,"title":"Receba novidades","subtitle":"Cadastre seu email para vagas e eventos","cta":"Inscrever"}'::jsonb, 'Bloco de newsletter'),
  ('partners', '{"title":"Parceiros","items":[]}'::jsonb, 'Parceiros / patrocinadores'),
  ('cta_section', '{"title":"Faça parte da comunidade","subtitle":"Junte-se a milhares de profissionais","button":"Cadastre-se"}'::jsonb, 'CTA da home'),
  ('password_policy', '{"expires_days":0,"default_reset_password":"GaleraTI@2026","require_change_on_reset":true}'::jsonb, 'Política de senha: validade (0=desativado) e senha padrão usada pelo admin ao resetar')
ON CONFLICT (setting_key) DO NOTHING;
