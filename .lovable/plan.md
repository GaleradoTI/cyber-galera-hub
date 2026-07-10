Vou entregar tudo em blocos coordenados. Volume grande, então preciso do seu ok antes de começar — depois disso executo sem parar.

## 1. Financeiro — usuário, torneio, filtros, CSV, logs

**Migração de banco:**
- `finance_entries`: adicionar `assigned_user_id uuid` (FK profiles), `tournament_id uuid` (FK, opcional).
- Nova tabela `tournaments` (id, name, starts_at, ends_at, status, created_by) — CRUD só admin/super.
- Triggers de auditoria com diff antes/depois em JSON (`old_row`, `new_row`) para `finance_entries`, `finance_categories`, `finance_tags`. Novo campo `audit_logs.diff jsonb` (nullable).
- RLS revisada.

**UI (`dashboard.financeiro.tsx`):**
- Selectores de "Responsável" (embaixador/admin) e "Torneio" no form de lançamento.
- Filtros: por responsável (multi) e por torneio.
- Export CSV: modal escolhe colunas (checkbox por campo), exporta usando exatamente os filtros ativos.

## 2. Feed social — performance + edição

- Paginação infinita com `useInfiniteQuery` (20 posts/página, `IntersectionObserver`).
- Índices adicionais em `member_feed_posts (created_at DESC)` e `post_comments (post_id, created_at)`.
- Editar/excluir comentários próprios; admin/super pode excluir qualquer um. Também no mural (`project_posts` se existir edição).
- Revisão das policies de `member_feed_posts`, `post_comments`, `post_reactions`, `user_follows`, garantindo `TO authenticated`.

## 3. Central de notificações

- Nova rota `/dashboard/notificacoes`: lista completa, filtro (lidas/não lidas/tipo), marcar como lida, marcar todas.
- Links já existem em `notifications.link`; garantir para follow/like/comment/news.
- Triggers novos: `notify_post_like`, `notify_post_comment` (se ainda não existirem).
- Sino no topo ganha "Ver todas" apontando para a página.

## 4. Perfil público

- Nova rota pública `/u/$username` (usa `profiles.display_name` slugificado ou `user_id`).
- Mostra: avatar, bio, tags, contadores de seguidores/seguindo, posts do usuário, notícias fixadas que ele publicou, botão seguir.
- Head com OG dinâmico via loader + server function pública.

## 5. Reset de senha + email refletido em tela

- Super admin: garantir que `resetUserPassword` funciona (verificar erro atual; provavelmente falta `SUPABASE_SERVICE_ROLE_KEY` ou middleware). Adicionar tratamento e log claro.
- Membro: já existe `/reset-password`; adicionar link "Alterar senha" em `dashboard.perfil.tsx` (fluxo: pede senha atual, chama `supabase.auth.updateUser`).
- Sincronia de email: hoje `profiles.email` só é setado no cadastro. Criar trigger em `auth.users` (via função) OU atualizar `profiles.email` no server function que altera email. Além disso, invalidar queries de `usuarios` após alteração e refazer o fetch (`realtime` ou `queryClient.invalidateQueries`).

## 6. Detalhes técnicos

- Novos server functions: `updateUserEmail` (admin), `changeMyPassword`.
- Realtime opcional em `notifications` para atualização instantânea.
- Todos os endpoints protegidos com `requireSupabaseAuth` + `has_role`.
- Testes: `tsgo` typecheck + verificação manual das rotas principais.

## Ordem de execução

1. Migração única (schema + triggers + RLS).
2. Types regenerados.
3. Frontend: financeiro → feed → notificações → perfil público → auth.
4. Typecheck final.

Estimativa: ~15 arquivos novos/editados, 1 migração grande.

Confirma para eu começar?