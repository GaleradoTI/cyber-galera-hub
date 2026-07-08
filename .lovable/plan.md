## Escopo

Cinco frentes, entregues numa mesma sequência de mudanças. Cada uma tem migração + UI própria.

---

### 1. Responsividade — navbar pública e layouts quebrados

- **`src/components/public/navbar.tsx`**: hoje o menu só aparece a partir de `lg` (1024px), então em tablets/notebooks pequenos (como o viewport atual 1034px, e principalmente entre 768–1023px) o menu fica escondido e o botão hambúrguer quebra por falta de espaço com os dropdowns.
  - Trocar breakpoint para `md:` no menu desktop e no bloco de ações (Entrar/Cadastrar/Dashboard).
  - Compactar padding/gap dos links no range md–lg (`px-2 lg:px-4`), reduzir label do botão Dashboard para ícone-only em md.
  - Header em grid `grid-cols-[auto_1fr_auto]` com `min-w-0` no bloco central para permitir truncar.
  - Ajustar menu mobile: adicionar `max-h-[calc(100vh-4rem)] overflow-y-auto` e fechar automaticamente ao trocar de rota (`useEffect` em `pathname`).
- **`src/components/dashboard/dashboard-shell.tsx`** (varredura rápida): garantir que o header do dashboard também siga o padrão `grid + min-w-0 + shrink-0` do knowledge de responsive.
- Passar Playwright headless em 375, 768 e 1034 pra confirmar visualmente antes de encerrar.

---

### 2. Feed social completo (curtir, comentar, repostar)

Reaproveita `member_feed_posts`, `post_reactions`, `post_comments` que já existem, e adiciona repost.

**Migração:**
- Adicionar coluna `reposted_from_id uuid REFERENCES member_feed_posts(id) ON DELETE SET NULL` em `member_feed_posts`.
- Adicionar coluna `kind text NOT NULL DEFAULT 'user'` em `member_feed_posts` com CHECK em `('user','news','repost')` — pra diferenciar posts normais, notícias oficiais (item 4) e reposts.
- View/RPC opcional `feed_post_stats(post_id)` — mas vamos calcular no client via queries já existentes pra manter simples.
- Audit trigger para reposts em `audit_logs`.

**UI — `src/routes/dashboard.feed.tsx` + novo `src/components/dashboard/feed-post-card.tsx`:**
- Reescrever card: header com avatar, nome, timestamp, badge de tipo (Notícia oficial / Repost).
- Ações inline: 👍 curtir (usa `post_reactions` com emoji fixo `👍` — mantém compatível), 💬 comentar (expande lista com `post_comments`), 🔁 repostar (abre um pequeno modal opcional pra adicionar comentário e cria novo post com `reposted_from_id` + `kind='repost'`).
- Render de post repostado: card aninhado com o post original embutido.
- Contadores em tempo real via `useQuery` por post (`post-reactions`, `post-comments`, e `reposts` = count de `member_feed_posts` com `reposted_from_id`).
- Placeholder de comentário permite links (autolinkify simples) e ⌘/Ctrl+Enter envia.
- Ordenação: notícias oficiais fixadas no topo (últimas 24h), depois cronológico.

---

### 3. Sistema de seguidores

**Migração — nova tabela `user_follows`:**
```
follower_id uuid NOT NULL       -- profiles.user_id
following_id uuid NOT NULL      -- profiles.user_id
created_at timestamptz default now()
PK (follower_id, following_id)
CHECK (follower_id <> following_id)
```
- Grants `authenticated`/`service_role`.
- RLS: SELECT liberado para authenticated (contadores públicos entre membros), INSERT/DELETE apenas quando `follower_id = auth.uid()`.
- Índices em `following_id` (pra listar seguidores de alguém) e `follower_id`.
- Notificação: trigger que insere em `notifications` para o `following_id` quando alguém segue.

**UI:**
- Novo hook `src/hooks/use-follow.ts` com `{ isFollowing, followerCount, followingCount, toggle }`.
- Botão "Seguir/Seguindo" em:
  - `src/components/profile/member-detail-dialog.tsx` (modal de membro).
  - `src/components/public/community-profile-card.tsx` (quando logado).
  - Novo `feed-post-card.tsx` (ao lado do nome do autor).
- Contadores no perfil próprio (`dashboard.perfil.tsx` — adicionar mini seção "X seguidores · Y seguindo").

---

### 4. Notícias diárias da comunidade (admin-only)

**Reuso:** posts com `kind='news'` na mesma tabela `member_feed_posts` — assim aparecem no feed sem duplicar infra. Campo extra:
- `title text` (nullable pra posts comuns, obrigatório via check quando `kind='news'`).
- `pinned_until timestamptz` (pra destacar por N horas).
- `cover_url text` (opcional).

**RLS:** apenas ADMIN/SUPER_ADMIN podem inserir/editar/deletar posts com `kind='news'`. Posts `user`/`repost` seguem regra atual.

**UI — nova rota `src/routes/dashboard.noticias.tsx`:**
- Listagem tabela: título, data, pinned, autor, ações (visualizar em modal, editar, deletar).
- Modal de criação/edição: título, conteúdo (textarea), cover_url, pinned_until (date-time).
- Modal de visualização com preview igual ao render do feed.
- Item no `dashboard-shell` sidebar (visível só para admin).

No feed geral, notícias renderizam com destaque visual (borda neon, badge "📰 Notícia oficial").

---

### 5. UX melhor em projetos (links de tarefas + comentários)

**Migração — nova tabela `project_task_links`:**
```
id uuid pk
project_id uuid NOT NULL REFERENCES projects
user_id uuid NOT NULL           -- quem anexou
title text NOT NULL
url text NOT NULL
note text
created_at timestamptz
```
- Grants + RLS: membros do projeto podem SELECT/INSERT/DELETE (via `is_project_member(project_id, auth.uid())` — provavelmente já existe; senão criar security-definer).

**Reuso `project_posts` (já existe)** para comentários entre membros — só melhorar UI em `dashboard.meus-projetos.tsx` / `explorar-projetos.tsx`:
- Aba "Discussão" com stream de `project_posts` (thread simples) — quem é membro comenta.
- Aba "Entregas" com lista de `project_task_links` — botão "Adicionar entrega" (título + url + nota).
- Notificação para líder quando membro adiciona entrega (trigger em `project_task_links`).

---

## Arquivos afetados

**Novos:**
- `supabase/migrations/<timestamp>_social_feed_follows_news.sql`
- `src/components/dashboard/feed-post-card.tsx`
- `src/components/dashboard/repost-dialog.tsx`
- `src/hooks/use-follow.ts`
- `src/routes/dashboard.noticias.tsx`
- `src/components/dashboard/news-editor-dialog.tsx`

**Editados:**
- `src/components/public/navbar.tsx` (responsividade)
- `src/components/dashboard/dashboard-shell.tsx` (item sidebar Notícias, checagem responsiva)
- `src/routes/dashboard.feed.tsx` (usa novo card, ordena notícias)
- `src/components/profile/member-detail-dialog.tsx` (botão seguir)
- `src/components/public/community-profile-card.tsx` (botão seguir)
- `src/routes/dashboard.perfil.tsx` (contadores)
- `src/routes/dashboard.meus-projetos.tsx` + `dashboard.explorar-projetos.tsx` (abas entregas/discussão)
- `src/routes/dashboard.logs.tsx` (`ENTITY_MAP` para user_follows, project_task_links)
- `README.md` (seções novas)

---

## Fora de escopo

- Notificações push/email (só in-app via `notifications`).
- Feed algorítmico (mantém cronológico + pinned).
- Rich text/imagens no editor de notícias — só texto + cover_url.
- Threads aninhadas em comentários — mantém 1 nível.
- Repost com quote elaborado — só comentário curto opcional.

## Verificação

- Playwright headless em 375/768/1034 px conferindo navbar e feed.
- Build + typecheck.
- Testar fluxo: criar notícia como admin, ver no feed como usuário comum, curtir, comentar, repostar, seguir autor.
