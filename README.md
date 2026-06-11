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
- SEO por rota (head() com title/description/og:* e twitter:*) — preview ao
  vivo de Google, Open Graph e Twitter Card no dashboard, aplicado no
  `<head>` do site público
- Autenticação por e-mail/senha

### Dashboard — Membro
- Visão geral com contagem de vagas salvas e eventos
- **Meu Perfil**: nome, e-mail, bio, área de atuação, "em busca de
  oportunidade", **redes sociais livres** (presets LinkedIn/GitHub/Instagram/
  Twitter/YouTube/Discord/Site + qualquer chave personalizada) e troca de
  senha
- **Vagas Salvas**: lista + remoção
- **Meus Eventos**: inscrições, lista de espera quando o evento atinge o limite de vagas e check-in confirmado
- **Sugerir Evento**: membros e recrutadores enviam eventos da comunidade
  ou de terceiros para aprovação por um admin
- **Meus Projetos**: squads que participo, mural de posts, modal de membro com contatos
- **Depoimentos**: enviar/editar/excluir depoimento (passa por moderação antes de aparecer no site público)
- Cartão de **participação** no perfil com check-ins, conversão e badges
  por marcos (Explorador → Embaixador)

### Dashboard — Admin
- CRUD de Vagas (busca, filtros, paginação)
- CRUD de Eventos com **fonte** (Comunidade × Terceiros), aprovação de
  sugestões enviadas por membros/recrutadores, limite de vagas + **lista
  de espera automática** com promoção quando uma vaga libera, métricas
  por evento e **exportação CSV** dos inscritos/check-ins
- Usuários: bloquear/reativar, editar, **resetar senha** para padrão configurável
- Projetos / Squads: capa + **banner separado** (hero da página pública,
  com fallback de gradiente + nome grande quando não há banner; upload com
  validação JPG/PNG/WebP, máx 8MB e redimensionamento automático para
  1920px), busca de membros por nome/e-mail e regra que impede o mesmo
  usuário em mais de um squad por projeto. Na página pública os membros
  aparecem ordenados por **Líder > Cargo no squad > Nome**.
- Depoimentos: aprovar / rejeitar com observação
- Configurações do Site: SEO (prévia Google, Open Graph e **Twitter Card** ao vivo), favicon com validação, histórico de versões com pré-visualização e reversão, hero, contact, about, stats, social_links, footer, newsletter, partners, cta_section, legal, password_policy
- **Logs de auditoria** preenchidos automaticamente: criação de usuário
  (`USER_CREATED`), alterações em projetos (`PROJECT_CREATED/UPDATED/
  DELETED`), configurações do site (`SETTING_UPDATED`), submissão e
  moderação de eventos (`EVENT_SUBMITTED`, `EVENT_APPROVED`,
  `EVENT_REJECTED`, `EVENT_CREATED`), check-ins (`EVENT_CHECKIN`) e
  lista de espera (`EVENT_WAITLIST`, `EVENT_WAITLIST_PROMOTED`)

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
## Nova rodada — Parceiros, Denúncias, Q&A e acesso restrito

- **Eventos da comunidade** agora só aparecem para usuários autenticados (RLS). Eventos de terceiros continuam públicos e, para visitantes anônimos, abrem direto no link externo.
- **Parceiros**: nova área admin em `/dashboard/parceiros` (logo, descrição, site, ordem, ativo). Carrossel autoplay na home pública.
- **Q&A por evento** (`event_questions`): perguntas dos inscritos com moderação por admin (aprovar/rejeitar/responder/apagar). Aprovadas ficam públicas no dialog do evento.
- **Denúncias** (`reports`) em vagas/eventos: botão "Denunciar" nos dialogs públicos, painel admin em `/dashboard/denuncias` com ações "Resolver", "Improcedente" e "Despublicar". Função `resolve_report()` move conteúdo para rascunho, registra audit log e notifica o autor.
- **Métricas de evento** agora incluem coluna de lista de espera e a exportação CSV consolida inscritos + check-ins + waitlist em uma planilha por evento.
- **Sidebar**: link "Explorar Vagas" no menu do membro para voltar à listagem pública sem sair do dashboard.

### Logs de auditoria adicionados
- `REPORT_RESOLVED` / `REPORT_DISMISSED` / `REPORT_UNPUBLISHED`

### Pendente / próximas sugestões
- Lembretes automáticos 24h/1h antes do evento (precisa configurar Lovable Emails ou push).
- Página pública de parceiros (`/parceiros`) com grid completo, além do carrossel da home.
- Página `/membros/:handle` com perfil público, badges e participação.
- Pesquisa pós-evento (NPS) para inscritos com check-in.
- Editor rico (markdown) para descrição de evento/vaga.
