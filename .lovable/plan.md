## Escopo

### 1. Card / botão "Saiba mais" minimalista
- Botão vira `variant="ghost"` compacto (só texto + ícone pequeno).
- Card mostra apenas: foto, nome, `role_title` (cargo), links de redes e o botão "Saiba mais".
- Remover badge de `community_role` do card — vai só no modal.
- `professional_story` e `community_role` continuam **exclusivos do modal**.

### 2. Reorganização do menu público (`NAV_LINKS`)
Menu atual tem 11 itens. Consolido em 6 grupos com dropdown:

```
Início | Sobre | Comunidade ▾ | Oportunidades ▾ | Conteúdo ▾ | FAQ
                 ├ Embaixadores       ├ Vagas             ├ Eventos
                 ├ Administradores    └ Projetos          ├ Drops
                 └ Parceiros                              └ Canais
```

- Atualiza `src/lib/site-config.ts` para estrutura `{ label, to?, children? }`.
- Atualiza `src/components/public/navbar.tsx` desktop (hover dropdown via `DropdownMenu`) e mobile (accordion simples).

### 3. Novo perfil `EMBAIXADOR`

**Migração:**
- Adiciona `EMBAIXADOR` no enum `app_role`.
- Adiciona coluna `user_id uuid REFERENCES auth.users(id)` em `public.community_profiles` (nullable, para vincular o admin ao registro do embaixador que ele pode editar).
- Novas policies em `community_profiles`:
  - Todos autenticados podem ver perfis ativos (já existe para público).
  - `EMBAIXADOR` pode UPDATE **apenas** onde `user_id = auth.uid()`.
  - Sem INSERT / DELETE para EMBAIXADOR.

**Sidebar (`dashboard-shell.tsx`):**
Nova seção "EMBAIXADOR" visível apenas com role `EMBAIXADOR`:
- Meu Perfil, Mensagens, Feed (já em "Geral")
- Eventos (view), Vagas (view), Parceiros (view), Candidatos (view), Depoimentos, Embaixadores/Admins (view + editar o próprio).

**Gates nas rotas admin:**
- `dashboard.eventos.tsx`, `dashboard.vagas.tsx`, `dashboard.parceiros.tsx`, `dashboard.candidatos.tsx`, `dashboard.comunidade-perfis.tsx`:
  - `useDashboardRoles` exporta novo flag `isAmbassador`.
  - Gate de acesso: `isAdmin || isAmbassador` (em vez de só `isAdmin`).
  - Prop `readOnly = isAmbassador && !isAdmin` esconde botões de criar/editar/excluir. Em `comunidade-perfis`, permite editar somente o card cujo `user_id === user.id`.

### 4. README + logs
- Documenta novo role EMBAIXADOR, escopo de permissões e novo campo `user_id` em `community_profiles`.
- Log `AMBASSADOR_PROFILE_UPDATED` em `audit_logs` quando embaixador salva seu próprio card.

### Fora de escopo (não pedido)
- Não cria fluxo de auto-onboard de embaixador (admin continua criando o registro e vinculando `user_id`).
- Não cria página pública nova.
