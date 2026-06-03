-- Add favicon setting and expand SEO settings
INSERT INTO public.public_site_settings (setting_key, setting_value, description)
VALUES (
  'favicon',
  '{"url": "/favicon.ico", "apple_touch_url": ""}'::jsonb,
  'Ícone do site (favicon). URL pode ser absoluta (https://...) ou um caminho relativo (/favicon.ico).'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Expand SEO with og_image and twitter handle
UPDATE public.public_site_settings
SET setting_value = setting_value
  || jsonb_build_object(
       'og_image', COALESCE(setting_value->>'og_image', ''),
       'twitter_site', COALESCE(setting_value->>'twitter_site', '@galeradoti'),
       'author', COALESCE(setting_value->>'author', 'GALERA DO T.I.')
     ),
  description = COALESCE(description, 'Metadados de SEO usados em todas as páginas (title, description, OG, Twitter).')
WHERE setting_key = 'seo';
