## Visão geral

Adicionar o papel **RECRUTADOR**, sistema de **cargos customizados** (tags), módulo de **Projetos/Squads** com líderes e membros, reorganizar a **sidebar** por perfil, e habilitar edição de perfil para o recrutador. Também listo sugestões de features novas no final.

---

## 1. Banco de dados (migração)

### 1.1 Novo papel `RECRUTADOR`
- Adicionar valor `RECRUTADOR` ao enum `app_role`.
- Atualizar `is_admin_or_super` permanece igual; criar helper `is_recruiter_or_admin(uid)` para policies de vagas.
- Permitir que `RECRUTADOR` faça **INSERT/UPDATE/DELETE** apenas nas próprias vagas (`jobs.created_by = auth.uid()`).
- Permitir que `RECRUTADOR` veja perfis de membros com `looking_for_job = true` (policy adicional em `profiles`).

### 1.2 Cargos customizados (badges)
Tabela `member_badges` para títulos como "Líder de Projeto", "Embaixador", etc., gerenciada apenas pelo SUPER_ADMIN.

```text
member_badges
- id, user_id, label (text), color (text), created_by, created_at
```

### 1.3 Módulo de Projetos / Squads
```text
projects
- id, name, slug, description, cover_url, status, created_by, created_at, updated_at

project_members
- id, project_id, user_id, role_in_project ('LIDER' | 'MEMBRO'),
  created_at  (unique project_id+user_id)
```

Policies:
- **SELECT**: membro do projeto OU admin/super.
- **INSERT/DELETE de project_members**: apenas SUPER_ADMIN.
- **UPDATE de projects**: líderes (`role_in_project='LIDER'`) e admins.
- **INSERT de projects**: admin/super.

### 1.4 Grants padrão (authenticated + service_role) em todas as tabelas novas.

---

## 2. Backend (server functions)

- `src/lib/projects.functions.ts`: list/get/create/update/delete projects, add/remove members, mudar role no projeto (super admin).
- `src/lib/badges.functions.ts`: list/create/delete badges (super admin).
- `src/lib/recruiter.functions.ts`: listar candidatos disponíveis (com `looking_for_job=true`), filtros por área.

---

## 3. Sidebar reorganizada por perfil

Estrutura final (`dashboard-shell.tsx`):

```text
TODOS
  Visão Geral
  Meu Perfil
  Meus Projetos                  (se for membro de algum projeto)

MEMBRO
  Vagas Salvas
  Meus Eventos

RECRUTADOR
  Minhas Vagas
  Candidatos
  Meus Eventos

ADMIN / SUPER_ADMIN
  Usuários
  Vagas (todas)
  Eventos
  Projetos
  Configurações do Site
  Logs

SUPER_ADMIN extra
  Cargos (Badges)
```

Agrupar com cabeçalhos sutis e ícones (sem quebrar o visual atual).

---

## 4. Telas novas

| Rota | Descrição |
|---|---|
| `/dashboard/projetos` | Admin: listar, criar, editar projetos + atribuir membros/líderes (super). |
| `/dashboard/meus-projetos` | Qualquer usuário membro de projeto: vê os projetos. Se for líder, edita nome/descrição/capa. |
| `/dashboard/candidatos` | Recrutador: lista membros com "em busca", filtros por área, link para contato (e-mail). |
| `/dashboard/minhas-vagas-postadas` | Recrutador: CRUD das próprias vagas (reaproveita o componente de vagas com filtro). |
| `/dashboard/cargos` | Super admin: cria/remove badges atribuídas aos membros. |

Adicionar exibição de **badges** no perfil público e na tela de Usuários.

---

## 5. Página pública

- Exibir badges junto ao nome do membro onde aplicável.
- Card de "Squads/Projetos" opcional no /sobre (apenas projetos com `status=publico`).

---

## 6. Features sugeridas (para você escolher depois)

1. **Mensagens diretas** entre recrutador ↔ candidato (in-app).
2. **Histórico de candidaturas**: rastrear "candidatei-me" em uma vaga.
3. **Notificações** (sino no header) — nova vaga na área, novo evento, etc.
4. **Tags de tecnologias no perfil** (React, Go, etc.) para filtro do recrutador.
5. **Convites para projetos**: super admin envia convite; usuário aceita.
6. **Estatísticas do projeto**: contagem de membros, eventos do squad.
7. **Mural do projeto**: posts internos visíveis só para o squad.
8. **Recrutador verificado**: badge de empresa aprovada pelo admin.
9. **Exportação CSV** de candidatos para o recrutador.
10. **Calendário unificado** de eventos por projeto.

---

## Detalhes técnicos

- Enum update via `ALTER TYPE app_role ADD VALUE 'RECRUTADOR'` (precisa estar fora de transação — usar migration dedicada).
- Manter `is_admin_or_super` para não quebrar policies existentes.
- Toda mutação sensível (criar projeto, mudar líderes, criar badge) passa por server function com `requireSupabaseAuth` + checagem de role server-side.
- `dashboard-shell.tsx` ganha agrupamento por seção, mantendo collapse.
- Atualizar `handle_new_user` se quiser permitir cadastro como recrutador no signup (proponho deixar como upgrade manual pelo super admin para evitar abuso).

---

## Ordem de execução

1. Migração SQL (enum + tabelas + policies + grants).
2. Server functions.
3. Sidebar reorganizada.
4. Telas: Projetos (admin) → Meus Projetos → Candidatos → Cargos → Minhas Vagas (recrutador).
5. Badges no perfil/usuários.
6. QA visual + smoke test em cada perfil.