
## 1. Metas dos projetos com tasks (descrição + checklist)

**SQL (migration)**
- Adicionar colunas em `squad_goals`: `description text`, `tasks jsonb default '[]'` (cada task: `{id, title, done, done_by, done_at}`).
- Função `toggle_goal_task(_goal_id uuid, _task_id text, _done bool)`:
  - Permite apenas líder do squad (ou admin/super) marcar/desmarcar.
  - Atualiza `tasks` no `squad_goals`, dispara `audit_logs` (`SQUAD_GOAL_TASK_TOGGLED`).

**Frontend**
- Em `dashboard.meus-projetos.tsx`: editor de meta agora aceita descrição e lista de tasks (add/remover título). Líder vê checkboxes interativos; membros veem somente leitura com progresso (`x/y tasks`).
- Mesma visualização (read-only) em `dashboard.explorar-projetos.tsx` e no detalhe de projeto público.

## 2. CSV de auditoria com contexto por entidade

- Em `dashboard.logs.tsx`, no `exportCsv`:
  - Para cada log exportado, buscar o "contexto" usando o mesmo mapa do componente `EntityContext` (projetos, squads, project_join_requests, public_site_settings…).
  - Achatar em colunas `ctx_<campo>` (ex.: `ctx_name`, `ctx_slug`, `ctx_status`).
  - Limite 5000 linhas, batch por entidade (group by entity → 1 query por entidade com `.in('id', ids)`).

## 3. URL persistente em /dashboard/logs (paginação + ordenação)

- Estender `searchSchema` com:
  - `sortBy: 'created_at' | 'action' | 'entity' | 'user_name'` (default `created_at`)
  - `sortDir: 'asc' | 'desc'` (default `desc`)
- Headers da tabela viram botões: clique alterna sortBy/sortDir, atualiza URL via `navigate({search})`.
- Query usa `.order(sortBy, { ascending: sortDir === 'asc' })`.
- `page` já está na URL — manter botões anterior/próxima escrevendo no search.

## 4. Feature "Drops" (loja interna de itens)

**Tabelas (migration, com GRANTS + RLS)**
- `drops`: `id, title, description, price_cents, currency default 'BRL', launch_date, status ('draft'|'published'|'closed'), pix_key, payment_methods text[], images text[], created_by, created_at, updated_at`.
- `drop_interests`: `id, drop_id, user_id (nullable se logado), full_name, email, phone, note, created_at`. Único `(drop_id, user_id)` quando user_id não nulo.
- RLS:
  - `drops` SELECT: público (qualquer pessoa) quando `status='published'`; admins veem tudo. INSERT/UPDATE/DELETE: somente `is_admin_or_super(auth.uid())`.
  - `drop_interests` SELECT: admins. INSERT: público (mas se autenticado, força `user_id = auth.uid()`).
- Triggers `log_drop_changes` e `log_drop_interest` → `audit_logs` (entidades `drops`, `drop_interests`).
- Bucket `project-covers` já existe → reaproveitar para imagens dos drops (folder `drops/{user_id}`).

**Rotas**
- Pública `/drops` (lista cards) + modal de detalhes com galeria, preço, data, formas de pagamento, botão "Tenho interesse" (form com nome/email/telefone — pré-preenchido pelo profile do usuário autenticado).
- Dashboard `/dashboard/drops` (apenas admin/super): CRUD com `ImageUploader`, status, lista de interessados (export CSV).
- Item no menu lateral (admin) + link no navbar público.

**Validações**
- Zod no formulário público (nome, email, telefone com máscara, max 100/255/20 chars).
- Toasts de sucesso/erro.

## 5. README + erros

- README: nova seção "Drops", nota sobre tasks em metas, sort/paginação por URL em logs, CSV com contexto.
- Rodar `tsc`/build após cada bloco e corrigir.

## Ordem de execução

1. Migrations (squad_goals.tasks + drops + drop_interests + triggers + RLS + grants).
2. Aguardar regen do types.ts.
3. Frontend (metas/tasks → CSV com contexto → sort URL → rotas drops).
4. README + verificação de build.

Quer que eu prossiga com as migrations nessa ordem?
