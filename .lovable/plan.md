## Escopo

### 1. Financeiro — CRUD completo (`dashboard.financeiro.tsx`)
- **Ver detalhes**: modal já parcial vira modal completo mostrando TODOS os campos do pedido (comprador, contato, produto, variante, tamanho, medidas do tamanho no momento da compra, material, entrega, endereço completo, valor, status, observação, usuário vinculado, datas de criação/atualização, histórico rápido).
- **Adicionar pedido manual**: botão "Novo pedido" abre modal com seleção de drop (select), variante, tamanho (populado a partir do drop selecionado), entrega + endereço, comprador (nome/email/telefone) opcionalmente vinculado a usuário existente (busca em `profiles`), valor, status e nota. Grava direto em `drop_interests` respeitando a nova policy de INSERT para admin.
- **Editar pedido**: mesmo modal em modo edição, permite alterar todos os campos (não só status).
- **Excluir pedido**: `AlertDialog` de confirmação → `DELETE` em `drop_interests`. Trigger de log registra `DROP_INTEREST_DELETED`.
- Filtros e KPIs continuam iguais.

### 2. Drops — Variantes (nova modelagem)
Novo conceito: um drop pode ter **N variantes** (ex.: "Camiseta tradicional", "Baby look", "Oversize"), cada variante com **material**, **preço opcional** (herda do drop se vazio), **imagens próprias** e **tamanhos** com medidas.

**Migração** — nova tabela `drop_variants`:
- `id`, `drop_id` (FK cascade), `name`, `material`, `price_cents` (nullable), `available_sizes text[]`, `size_measurements jsonb`, `images text[]`, `display_order`, `is_active`, `created_at/updated_at`.
- RLS: SELECT público quando o drop for `published`; INSERT/UPDATE/DELETE apenas ADMIN/SUPER_ADMIN.
- Trigger de audit `log_drop_variant_changes` (CREATED/UPDATED/DELETED).
- `drop_interests` ganha coluna `variant_id uuid REFERENCES drop_variants(id) ON DELETE SET NULL`.

**Tela `dashboard.drops.tsx`**:
- Dentro do editor, seção "Variantes" com lista (drag-order opcional, por enquanto botões ↑↓). Cada variante tem seu próprio bloco: nome, material, preço override, imagens.
- **Tamanhos dinâmicos**: em vez de presets fixos (PP..XG), input livre — o admin digita `PP`, `GGG`, `4XL`, etc. e clica "+ tamanho"; cada tamanho vira um chip removível com campo de medidas ao lado. Nada é hardcoded.
- Mantém `product_category` no drop (nível pai) — variante é só para vestuário/afins.

**Tela pública `drops.tsx`**:
- No modal de compra, se o drop tiver variantes ativas: RadioGroup "Modelagem" listando variantes; ao escolher, mostra medidas específicas e select de tamanho da variante escolhida.
- `variant_id` gravado junto no `drop_interests`.

**`dashboard.financeiro.tsx`**: coluna extra "Variante" (nome), filtro por variante, detalhe mostra variante + medidas snapshot.

### 3. Atribuir papel EMBAIXADOR (`dashboard.usuarios.tsx`)
- Adiciona valor `EMBAIXADOR` no enum `app_role` (migração).
- Na linha do usuário, botão "Tornar Embaixador" / "Remover embaixador" — insere/remove em `user_roles` (visível para ADMIN/SUPER_ADMIN, mesma regra atual de `promoteToAdmin`).
- `RoleBadge`, `primaryOf`, filtro de papel — mapeia o novo valor (rótulo "Embaixador", cor `secondary`).
- Trigger `log_user_role_changes` já cobre o evento.

### 4. Perfis públicos (`dashboard.comunidade-perfis.tsx`) — Ver + Vincular usuário
- Card ganha botão "Ver detalhes" que abre modal **somente-visualização** com todos os campos (foto grande, história, cargo, redes com links clicáveis, ordem, status, vinculação atual).
- Dentro do mesmo modal: seção "Vincular a um usuário" com busca por email/nome em `profiles` (autocomplete simples) → grava `user_id` no `community_profiles` (coluna já existe). Botão "Desvincular" limpa o campo. Só ADMIN pode alterar; embaixador só vê.
- O modal de **edição** existente continua igual (permanece separado).

### 5. Logs + README
- Novos eventos de audit: `DROP_INTEREST_CREATED_MANUAL`, `DROP_INTEREST_DELETED`, `DROP_VARIANT_CREATED/UPDATED/DELETED`, `COMMUNITY_PROFILE_LINKED/UNLINKED`, e reuso automático para `ROLE_GRANTED EMBAIXADOR`.
- README documenta variantes, papel embaixador, financeiro CRUD e vínculo de perfis.

### Fora de escopo
- Estoque por tamanho/variante (só descritivo por enquanto).
- Preço variável dentro de uma variante por tamanho.
- Fluxo de pagamento real.

### Assumindo (avisa se quiser diferente)
- Variante NÃO tem estoque nem SKU; é só especificação visual/técnica.
- Ao excluir uma variante que já tem pedidos, `variant_id` vira NULL nos pedidos (não bloqueia).
- Papel EMBAIXADOR não dá acesso ao dashboard admin — só marca o usuário (o gate de admin no shell continua igual). Se quiser que embaixador tenha acesso a algo específico, me diga.
