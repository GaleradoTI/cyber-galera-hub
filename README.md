# GALERA DO T.I.

Comunidade tech brasileira: vagas, eventos, canais e conteúdo. Construída em **TanStack Start v1** + **Supabase**.

## Stack

- TanStack Start v1 (React 19, SSR no Cloudflare Workers)
- Vite 7
- Tailwind CSS v4 (tokens em `src/styles.css`)
- shadcn/ui + Radix
- Supabase (Auth, Postgres, RLS)
- TanStack Query
- Zod (validação)

## Funcionalidades

### Área pública
- Home com hero, estatísticas e CTA configuráveis
- Vagas, Eventos, Canais, FAQ, Sobre, Termos, Privacidade
- SEO por rota (head() com title/description/og:*)
- Autenticação por e-mail/senha

### Dashboard — Membro
- Visão geral com contagem de vagas salvas e eventos
- **Meu Perfil**: nome, e-mail, bio, área de atuação, "em busca de oportunidade", redes sociais e troca de senha
- **Vagas Salvas**: lista + remoção
- **Meus Eventos**: inscrições + remoção

### Dashboard — Admin
- CRUD de Vagas (busca, filtros, paginação)
- CRUD de Eventos (modais)
- Usuários: bloquear/reativar, editar, **resetar senha** para padrão configurável
- Configurações do Site: edita JSON de todas as chaves de `public_site_settings`
  (hero, contact, about, stats, social_links, footer, seo, newsletter, partners, cta_section, legal, password_policy)
- Logs de auditoria

### Dashboard — Super Admin
- Tudo do Admin
- Promover/rebaixar ADMIN
- Política de senha (`password_policy`): senha padrão de reset e validade (em dias)

## Setup

```bash
bun install
bun run dev
```

Variáveis (.env já é populada pelo Lovable Cloud):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
# Server-only:
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Banco de Dados

Tabelas principais: `profiles`, `user_roles`, `jobs`, `events`, `channels`, `faqs`,
`saved_jobs`, `user_event_interests`, `public_site_settings`, `audit_logs`, `lgpd_consents`.

Funções: `is_admin_or_super`, `has_role`, `handle_new_user`, `promote_user_to_super_admin`.

Papéis: `MEMBRO`, `MODERADOR`, `ADMIN`, `SUPER_ADMIN`.

Promover o primeiro SUPER_ADMIN (SQL Editor):

```sql
SELECT public.promote_user_to_super_admin('seu@email.com');
```

## Estrutura

```
src/
  routes/             # File-based routing (TanStack Router)
  components/
    public/           # Componentes da área pública
    dashboard/        # Shell + utilitários do dashboard
    ui/               # shadcn/ui
  integrations/supabase/
    client.ts             # Browser
    auth-middleware.ts    # Server fn auth
    client.server.ts      # Admin (service role)
  lib/
    *.functions.ts    # Server functions (createServerFn)
  styles.css          # Tokens Tailwind v4
```

## Deploy

- **Lovable (recomendado)**: botão Publish (`*.lovable.app`)
- **Cloudflare Workers**: `bun run deploy` (preset Workers em `vite.config.ts`)
- **Vercel**: apenas estáticos. `vercel.json` aponta `outputDirectory: dist/client`.
  Server functions e SSR não rodam neste destino sem migrar o preset.

## Segurança

- RLS em todas as tabelas
- Roles em tabela separada (`user_roles`) com `SECURITY DEFINER` `has_role`
- Server functions sensíveis (reset de senha) usam `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor
- Validação Zod em entradas server-side
- LGPD: `lgpd_consents` com versão de termos

## Licença

Privado — comunidade GALERA DO T.I.