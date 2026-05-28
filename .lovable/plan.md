# Plano de implementação

Escopo grande — vou entregar em **3 ondas** para manter qualidade e revisar entre cada uma.

---

## Onda 1 — Fundação (migração + uploads + edição de cargos)

### 1.1 Migração SQL (banco)
- **`member_badges`**: já tem CRUD; só falta UI de edição (sem migração).
- **`notifications`** (nova): `user_id`, `type`, `title`, `body`, `link`, `read_at`. RLS: dono lê/atualiza; admin/sistema insere via server fn.
- **`direct_messages`** (nova): `sender_id`, `recipient_id`, `content`, `read_at`. RLS: só remetente/destinatário leem.
- **`post_comments`** (nova): `post_id`, `user_id`, `content`. RLS: membros do projeto.
- **`post_reactions`** (nova): `post_id`, `user_id`, `emoji`. Unique (post,user,emoji). RLS: membros do projeto.
- **`profiles`**: adicionar `is_verified_recruiter boolean default false` (só super_admin altera via policy específica).
- **`projects`**: adicionar `is_public boolean default false`, `tech_stack text[]`.
- **Storage buckets**: `avatars` (público), `project-covers` (público) + RLS por dono.

### 1.2 Edição de cargos (`/dashboard/cargos`)
- Botão de editar em cada badge: label, cor.
- Filtro por usuário, busca por label.

### 1.3 Uploads
- Avatar do perfil (`/dashboard/perfil`): troca de URL colada para uploader.
- Capa do projeto (`/dashboard/projetos`): idem.
- Componente reutilizável `ImageUploader` em `src/components/ui/image-uploader.tsx`.

---

## Onda 2 — Engajamento (notificações + mural + badges em usuários)

### 2.1 Notificações
- Sino no header do dashboard (`dashboard-shell.tsx`) com badge de não lidas.
- Dropdown lista as 10 mais recentes, marca como lida ao clicar, link para o item.
- Server fn `createNotification` chamada nos eventos: nova candidatura recebida, virou líder de squad, novo post no seu squad, nova DM.
- Polling a cada 30s (sem realtime para manter simples).

### 2.2 Mural — comentários e reações
- Em `dashboard.meus-projetos.tsx`: expandir cada post.
- Reações: 👍 ❤️ 🚀 🎉 — clica para toggle.
- Comentários: input simples, lista cronológica, autor pode deletar o próprio.

### 2.3 Badges na lista de usuários
- `/dashboard/usuarios`: mostrar badges ao lado do nome.
- Super admin: botão "+ Cargo" abre popover para atribuir/remover.
- Filtro por badge no topo da tabela.

---

## Onda 3 — Recrutador & público (DMs + verificado + página pública + home renovado)

### 3.1 Mensagens diretas
- Nova rota `/dashboard/mensagens` (lista de conversas + thread).
- Botão "Enviar mensagem" em `/dashboard/candidatos` (recrutador → candidato).
- Inbox simples, sem typing/realtime; refresh em foco + polling 20s.

### 3.2 Recrutador verificado
- Super admin marca `is_verified_recruiter` na tela de usuários (botão dedicado).
- Badge "Recrutador verificado" visível em vagas e DMs.
- Filtro "só recrutadores verificados" na visão pública (futuro).

### 3.3 Página pública do projeto
- Rota nova `/projetos/$slug` (público se `is_public=true`).
- Mostra: nome, descrição, capa, squads e líderes (nome + avatar), tech_stack.
- Server fn pública (admin client) que retorna só campos seguros.
- Link de "Página pública" no card do projeto admin quando `is_public=true`.
- Toggle "Tornar pública" no edit de projeto.

### 3.4 Dashboard Home renovado (`/dashboard`)
- **Membro**: cards "Vagas casadas com suas tech tags", "Minhas candidaturas em andamento", "Próximos eventos".
- **Recrutador**: funil (Enviadas / Em análise / Contratado / Rejeitada) das suas vagas, total candidatos novos na semana.
- **Admin/Super**: KPIs (usuários ativos, vagas publicadas, eventos próximos, projetos ativos).

---

## Detalhes técnicos

- Tudo em React + TanStack Router + Supabase JS (padrão do projeto).
- Mutações sensíveis (criar notificação cruzada, marcar verificado, página pública) via `createServerFn` com `requireSupabaseAuth` e checagem de role server-side.
- RLS sempre via funções `is_admin_or_super`, `has_role`, `is_project_member`, `is_squad_leader` já existentes; criar `is_message_participant` se necessário.
- Storage: paths `{user_id}/{filename}` para isolar via RLS.
- Sem realtime — polling leve para manter custo zero.

---

## Ordem de execução

1. **Onda 1** (migração + edição cargos + uploads) — confirmo com você antes de seguir
2. **Onda 2** (notificações + mural + badges em usuários)
3. **Onda 3** (DMs + verificado + página pública + home renovado)

Posso começar pela Onda 1 agora?
