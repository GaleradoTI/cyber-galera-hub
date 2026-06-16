# Plano — Próxima rodada

## 1. Página de Auditoria com filtros e exportação CSV
Reescrever `/dashboard/logs`:
- Filtros: usuário (autocomplete por nome/email), ação (select com todas as ações distintas), entidade (select), intervalo de datas, busca textual na descrição.
- Tabela com paginação (50 por página) + botão **"Ver detalhes"** que abre Dialog mostrando `metadata` JSON, `entity_id`, `user_id`, link para o recurso quando aplicável.
- Botão **"Exportar CSV"** respeita filtros aplicados; preview mostra contagem antes do download.

## 2. Triggers de auditoria faltantes
Migração SQL adicionando triggers/INSERTs em `audit_logs` para:
- `project_posts` (post mural): `PROJECT_POST_CREATED/DELETED`
- `post_comments`: `POST_COMMENT_CREATED/DELETED`
- `squad_members`: `SQUAD_MEMBER_ADDED/REMOVED/ROLE_CHANGED`
- `squad_events` (metas — nova tabela abaixo): `SQUAD_GOAL_CREATED/UPDATED/COMPLETED`
- `channels`, `faqs`, `lgpd_consents` (consent registrado)
- `project_join_requests` (nova tabela): `PROJECT_JOIN_REQUESTED/APPROVED/REJECTED`
- Páginas públicas relevantes: log de visualização não — apenas ações (denúncia já existe, candidatura já existe). Adicionar `JOB_APPLIED` e `EVENT_INTEREST_REGISTERED` que hoje não geram log.

## 3. Upload de banner — UX e correção do erro
- Investigar bucket/policy: `project-covers` precisa permitir `INSERT` para `authenticated` na pasta `events/` (criar/ajustar policy de storage caso esteja faltando — provavelmente é a causa do erro).
- Em `ImageUploader`:
  - Barra de progresso real (XHR upload event) com %.
  - Toast inicial "Validando…" → "Enviando X%…" → sucesso/erro.
  - Mensagens explícitas: "Formato inválido — aceitos: JPG, PNG, WebP. Recebido: <tipo>" e "Arquivo de 12MB excede o limite de 8MB."
  - Hint padrão visível em **todos os usos** (avatar, capa projeto, banner projeto, banner evento) listando extensões + tamanho máximo + dimensões recomendadas.
  - Exibir erro do Supabase Storage de forma legível (status 403/413 → mensagem amigável).

## 4. Metas (squad goals) com prazo
Nova tabela `squad_goals`:
- Campos de domínio: `project_id`, `squad_id` (nullable = meta do projeto todo), `title`, `description`, `due_date`, `order_index`, `created_by`.
- Tabela `squad_goal_completions`: `goal_id`, `squad_id`, `completed_by`, `completed_at`, `note`.
- RLS: admin/super criam/editam/excluem; líder do squad e membros marcam conclusão do **próprio** squad; todos os membros do projeto leem.
- UI Admin: aba **"Metas"** em `/dashboard/projetos` (modal por projeto) — criar/editar/reordenar metas com prazo, ver status por squad (matriz squads × metas com ✅/⏳/⚠ atrasada).
- UI Membro: card em `/dashboard/meus-projetos` listando metas do squad com botão "Marcar como concluída".

## 5. Projetos públicos + solicitação de entrada
- Página `/projetos` pública (já existe `projetos.index.tsx` — revisar) listando todos os projetos `is_public=true` com status (`em_andamento`, `pausado`, `concluido`) e badge **"Vagas abertas"** ou **"Lista de espera"**.
- Cada squad ganha flag `recruiting_status` (`open` | `closed` | `waitlist`) — campo novo em `squads`.
- Nova tabela `project_join_requests`: `project_id`, `squad_id` (opcional — usuário escolhe ou fica "qualquer squad"), `user_id`, `status` (`pending`/`approved`/`rejected`/`waitlist`), `message`, `decided_by`, `decided_at`.
- Página pública do projeto mostra botão **"Solicitar entrada"** (ou "Entrar na lista de espera") por squad — abre dialog com mensagem opcional.
- Notificação enviada ao **líder do squad escolhido** (e admins como fallback).

## 6. Líder do squad aprova entrada
- Em `/dashboard/meus-projetos`, líderes veem aba **"Solicitações"** com pedidos pendentes do(s) seu(s) squad(s).
- Ações: **Aprovar** (cria `squad_members` com role MEMBRO; respeita trigger anti-duplicação), **Rejeitar** (com motivo opcional), **Mover para lista de espera**.
- Admin/super veem todas as solicitações em `/dashboard/projetos`.
- Função RPC `approve_join_request(_request_id)` faz tudo atomicamente + log + notificação ao solicitante.

## 7. README + logs
- Atualizar `README.md` documentando: nova auditoria, metas, projetos públicos, fluxo de solicitação, política de upload.
- Listar todas as novas ações de log em uma tabela.

## Detalhes técnicos

```text
Tabelas novas
├── squad_goals (project_id, squad_id?, title, description, due_date, order_index)
├── squad_goal_completions (goal_id, squad_id, completed_by, completed_at, note)
└── project_join_requests (project_id, squad_id?, user_id, status, message, decided_by)

Alterações
├── squads + recruiting_status enum
└── audit_logs novos triggers
```

Stack: TanStack server fns para mutações sensíveis (aprovar/rejeitar entrada via `requireSupabaseAuth`); RPC SQL `approve_join_request` para atomicidade. Exportação CSV reaproveita `src/lib/csv.ts`.

## Ordem de execução
1. Migração SQL única (tabelas + triggers + RPC + policies de storage).
2. Server fns + atualização de tipos.
3. UI: Auditoria → Upload → Metas → Projetos públicos → Solicitações.
4. README.

Posso seguir?
