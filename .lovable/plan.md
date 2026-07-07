## Escopo

Transformar o Financeiro em um **livro-caixa completo** (não só pedidos de drops), com CRUD total, categorização flexível e integração com o que já existe (pedidos de drops entram como receita automaticamente).

---

### 1. Nova modelagem — `finance_*`

**Migração** cria três tabelas + enum:

- `finance_entry_kind` enum: `RECEITA`, `DESPESA`, `DOACAO`.
- **`finance_categories`** — CRUD pelo admin. Colunas: `id`, `name`, `kind` (enum acima), `color` (hex opcional p/ chip), `is_active`, `display_order`, `created_at/updated_at`. Ex.: "Torneio", "Drops", "Doação de material", "Serviço", "Infra/servidor", "Marketing".
- **`finance_tags`** — CRUD pelo admin. Colunas: `id`, `name`, `color`, `is_active`, `created_at`. Livre (ex.: "campeonato-abril", "patrocínio-x", "nota-fiscal").
- **`finance_entries`** — o lançamento em si.
  - `id`, `kind` (enum), `category_id` (FK, nullable p/ tolerar limpeza), `title`, `description`, `amount_cents` (positivo sempre; o sinal vem do `kind`), `entry_date` (date, default hoje), `status` (`pending` | `confirmed` | `cancelled`), `payment_method` (texto livre: pix, dinheiro, cartão…), `counterparty_name` (nome de quem pagou/recebeu), `counterparty_email`, `counterparty_phone`, `linked_user_id` (FK profiles.user_id ON DELETE SET NULL — comprador/doador vinculado à plataforma), `drop_interest_id` (FK opcional p/ pedido de drop origem), `attachment_url` (comprovante), `note`, `created_by`, `created_at/updated_at`.
- **`finance_entry_tags`** — junção N:N `entry_id` / `tag_id` (PK composta, cascade).

Todas com **RLS admin-only** (SELECT/INSERT/UPDATE/DELETE via `is_admin_or_super(auth.uid())`; `service_role` full). GRANTs para `authenticated` + `service_role` (sem `anon`). `updated_at` trigger.

**Audit triggers** (novos, logam em `audit_logs`):
- `log_finance_entry_changes` → `FINANCE_ENTRY_CREATED/UPDATED/DELETED` com título e valor formatado.
- `log_finance_category_changes` → `FINANCE_CATEGORY_CREATED/UPDATED/DELETED`.
- `log_finance_tag_changes` → `FINANCE_TAG_CREATED/UPDATED/DELETED`.

**Sincronização com drops**: trigger `sync_drop_interest_to_finance()` em `drop_interests`:
- Ao INSERT: cria automaticamente uma `finance_entries` (`kind='RECEITA'`, `category_id` = categoria "Drops" via seed, `title = 'Drop: '||titulo`, `amount_cents`, `status` = 'confirmed' se drop_interest for `paid/delivered` senão `pending`, `linked_user_id`, `drop_interest_id`, `counterparty_*`).
- Ao UPDATE de `status/amount_cents`: sincroniza a `finance_entries` correspondente.
- Ao DELETE: remove a entry (`ON DELETE CASCADE` na FK).

**Seed** (via migration): categorias iniciais "Drops" (RECEITA), "Torneio" (RECEITA), "Doação recebida" (DOACAO), "Serviço prestado" (RECEITA), "Infraestrutura" (DESPESA), "Marketing" (DESPESA), "Material" (DESPESA).

### 2. Tela `dashboard.financeiro.tsx` — reescrita

Duas abas (Tabs shadcn):

**Aba "Lançamentos"** (padrão):
- KPIs recalculados: **Receita**, **Despesas**, **Doações**, **Saldo** (receita+doação−despesa), **Pendente**. Todos respeitando filtros.
- Filtros: busca (título/contraparte), tipo (RECEITA/DESPESA/DOACAO/todos), categoria (select popular dinâmico), tag (multi-select), status, método pagamento, período (de/até por `entry_date`), origem (manual / drop). Chips ativos + "limpar tudo".
- Tabela: data, tipo (badge colorido), categoria (chip cor), título, contraparte + usuário vinculado (ícone), tags, valor (colorido: verde receita/doação, vermelho despesa), status, ações (Ver / Editar / Excluir).
- **Botão "Novo lançamento"** abre modal com todos os campos. Categoria/Tag têm botão "+ criar" inline.
- **Editar**: mesmo modal populado. **Não** permite editar entries geradas por drop (drop_interest_id != null) para os campos `amount_cents/counterparty_*/kind/category` — mostra aviso "Sincronizado com pedido do drop". Só permite editar `note`, `tags`, `attachment_url`, `status`.
- **Excluir**: AlertDialog. Bloqueia exclusão de entries com `drop_interest_id` (exclua o pedido em vez disso).
- **Ver detalhes**: modal read-only com tudo, incluindo timeline (created_at/updated_at, criador), pedido do drop vinculado (link).

**Aba "Categorias & Tags"**:
- Duas listas gerenciáveis. Cada categoria/tag: nome + cor + tipo (categoria) + toggle ativo + editar/excluir. Excluir com AlertDialog.
- Import: `HexColorPicker` — não; usa `<input type="color">` nativo pra não adicionar dep.

### 3. Vincular embaixadores/administradores a usuários

Na `dashboard.usuarios.tsx` (admins/embaixadores) e `dashboard.comunidade-perfis.tsx` (community_profiles) — a segunda já está no plano anterior (autocomplete de `profiles` no modal "Ver detalhes"). Confirmar ambos:

- **`dashboard.usuarios.tsx`**: onde estão os "admins" já é a tabela `profiles` filtrada por role. O "vínculo com usuário" **já é intrínseco** (todo admin/embaixador é um profile). Extra pedido: mostrar no modal de detalhes o **community_profile vinculado** (se houver) e permitir "vincular perfil da comunidade a este usuário" (busca em `community_profiles` que ainda não têm `user_id` e atribui). Mesmo endpoint da tela de comunidade, invertido.
- Confirma que a promoção `EMBAIXADOR` já feita no ciclo anterior está funcional.

### 4. Logs Supabase — normalização

- Padroniza descrições dos novos triggers com formato `"<verbo> <entidade>: <título> (R$ X,XX)"`.
- No `dashboard.logs.tsx` — adiciona `finance_entries`, `finance_categories`, `finance_tags` ao `ENTITY_MAP` (para exportação e contexto), com colunas relevantes.

### 5. README

Seção nova **"Financeiro"** explicando: livro-caixa, tipos (receita/despesa/doação), categorias e tags customizáveis, sincronização automática com pedidos de drops, vínculo com usuários, filtros salvos em URL futuramente (não agora). Atualiza também seção de auditoria listando os novos eventos.

---

### Fora de escopo (avisa se quiser)
- Recorrência de lançamentos.
- Anexo real de comprovante (por enquanto só URL manual).
- Relatórios agregados por mês/gráficos.
- Conciliação bancária, múltiplas contas, moedas.
- Split de valor entre categorias no mesmo lançamento.

### Assunções
- Doação com valor 0 (ex.: doação de material) é permitida — `amount_cents >= 0`.
- Ao excluir uma categoria em uso, os lançamentos ficam com `category_id NULL` (não bloqueia).
- Entry gerado por drop é imutável nos campos financeiros (ver acima). Se quiser desacoplar totalmente (drop segue seu fluxo, financeiro é 100% manual), me diga.
- Só ADMIN/SUPER_ADMIN acessam a tela e o dado. Embaixador NÃO vê.
