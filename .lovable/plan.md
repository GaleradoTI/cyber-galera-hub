## Escopo

### 1. Login obrigatório para reservar drop
- Em `src/routes/drops.tsx`, o botão "Tenho interesse" só abre o modal se `isAuthenticated`. Caso contrário, redireciona para `/login?redirect=/drops`.
- Pré-preenche `full_name`, `email`, `phone` do `profiles` do usuário logado — o formulário vira "confirme seus dados" (campos editáveis, mas já preenchidos).
- Remove suporte a `user_id: null` em `drop_interests` (interesse anônimo).

### 2. Novos campos no catálogo de drops (admin)
Migração em `drops`:
- `material text` (ex: "Algodão 100%")
- `product_category text` — `'apparel' | 'accessory' | 'sticker' | 'other'`. Quando `apparel`, o formulário exige tamanho + entrega.
- `available_sizes text[]` (ex: `{P,M,G,GG}`)
- `size_measurements jsonb` — mapa `{ "M": "Largura 52cm · Altura 72cm", ... }` mostrado quando o comprador seleciona o tamanho.

Tela `dashboard.drops.tsx`: adicionar esses campos no formulário de criação/edição (categoria como select; tamanhos como chips multi-select; medidas como lista de inputs por tamanho selecionado).

### 3. Formulário de compra ampliado
Migração em `drop_interests`:
- `size text` (obrigatório se `product_category = 'apparel'`)
- `delivery_method text` — `'pickup' | 'shipping'`
- Endereço (usado se `shipping`): `address_zip`, `address_street`, `address_number`, `address_complement`, `address_district`, `address_city`, `address_state`
- `amount_cents integer` — snapshot do preço no momento da compra
- `status text` default `'pending'` — `'pending' | 'paid' | 'delivered' | 'cancelled'`
- `linked_user_id uuid REFERENCES auth.users(id)` — admin pode vincular manualmente ao usuário existente (além do `user_id` que já vem do login).

No modal do `drops.tsx` público:
- Se `product_category = 'apparel'`: mostra select de tamanho (com medidas embaixo) + rádio pickup/correio + campos de endereço quando "correio".
- Validação zod estendida.

### 4. Tela Financeiro (`/dashboard/financeiro`)
Nova rota — visível **apenas** para ADMIN/SUPER_ADMIN (`isAdmin` no `useDashboardRoles`, gate na sidebar + no `beforeLoad` do componente).

Conteúdo:
- **KPIs no topo**: Receita total (soma `amount_cents` onde `status='paid'`), pendente, número de pedidos, ticket médio.
- **Tabela de vendas** unificada (por enquanto só `drop_interests`, mas estrutura preparada para outros tipos):
  - Colunas: Data, Produto (drop.title), Tipo (drop.product_category), Tamanho, Entrega, Valor, Status, Comprador (nome + email + telefone), Usuário vinculado.
- **Filtros / pipe de filtros** (chips no topo, empilháveis):
  - Produto (drop), Categoria, Status, Método de entrega, Período (date range), Busca livre (nome/email/telefone).
- **Ação: vincular a usuário** — abre popover com busca de `profiles` por nome/email e salva `linked_user_id`. Auto-sugere match por email quando existir.
- **Ação: mudar status** (pending → paid → delivered / cancelled).
- Exportar CSV (usando `src/lib/csv.ts` existente).

### 5. RLS
- `drop_interests`: SELECT full para ADMIN/SUPER_ADMIN; usuário continua vendo apenas os próprios. UPDATE (status/linked_user_id) apenas ADMIN/SUPER_ADMIN.
- Nova policy para admin buscar `profiles` por email (já existe policy de admin em `profiles`, reaproveita).

### 6. Sidebar + navegação
- Adiciona item "Financeiro" (ícone `DollarSign` do lucide) na seção ADMIN do `dashboard-shell.tsx`, gated por `isAdmin`.

### 7. README + logs
- README: documenta módulo Financeiro, novos campos de drop, fluxo de compra com login obrigatório.
- Trigger `log_drop_interest` já existe — estender para logar mudança de status (`DROP_INTEREST_STATUS_CHANGED`) e vinculação de usuário (`DROP_INTEREST_LINKED`).

### Fora de escopo
- Integração real de pagamento (Stripe/Paddle) — só registro manual do status por admin.
- Cálculo de frete automático — endereço é só coletado.
- Notas fiscais / relatórios contábeis.

### Perguntas em aberto (assumo default; me avise se quiser mudar)
- Moeda única BRL (já é o padrão do `drops`).
- CEP: campo livre por enquanto, sem auto-preencher via ViaCEP (posso adicionar depois).
- "Tipo de venda" = `product_category` do drop (apparel/accessory/sticker/other). Se quiser algo separado (ex: "produto físico vs digital"), me diga.
