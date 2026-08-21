-- Permite múltiplos links (site, redes sociais, etc.) por parceiro, exibidos abaixo do logo
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '[]'::jsonb;
