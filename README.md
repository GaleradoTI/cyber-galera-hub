# GALERA DO T.I.

Comunidade tech brasileira: vagas, eventos, canais e conteúdo. Construída em **TanStack Start v1** + **Supabase**.

## Stack

- TanStack Start v1 (React 19, SSR no Cloudflare Workers)
- Vite 7
- Tailwind CSS v4 (tokens em `src/styles.css`)
- shadcn/ui + Radix
- Supabase (Auth, Postgres, RLS)
- TanStack Query
- Zod (validação)

## Funcionalidades

### Área pública
- Home com hero e CTA configuráveis; estatísticas públicas vêm dos totais reais do banco (`get_public_home_stats`)
- Vagas, Eventos, Canais, FAQ, Sobre editável, Embaixadores, Administradores, Termos, Privacidade
- Mascotes configuráveis para páginas públicas (home, sobre, embaixadores, administradores, vagas, eventos, projetos, drops, canais, parceiros, FAQ e rodapé), com imagem e local de exibição
- SEO por rota (head() com title/description/og:* e twitter:*) — preview ao
  vivo de Google, Open Graph e Twitter Card no dashboard, aplicado no
  `<head>` do site público
- Autenticação por e-mail/senha

### Dashboard — Membro
- Visão geral com contagem de vagas salvas e eventos
- **Meu Perfil**: nome, e-mail, bio, área de atuação, "em busca de
  oportunidade", **redes sociais livres** (presets LinkedIn/GitHub/Instagram/
  Twitter/YouTube/Discord/Site + qualquer chave personalizada) e troca de
  senha
- **Vagas Salvas**: lista + remoção
- **Meus Eventos**: inscrições, lista de espera quando o evento atinge o limite de vagas e check-in confirmado
- **Sugerir Evento**: membros e recrutadores enviam eventos da comunidade
  ou de terceiros para aprovação por um admin
- **Meus Projetos**: squads que participo, mural de posts, modal de membro com contatos
- **Depoimentos**: enviar/editar/excluir depoimento (passa por moderação antes de aparecer no site público)
- **Feed da Galera** (`/dashboard/feed`): membros publicam textos e links; autor remove o próprio post e ADMIN/SUPER_ADMIN moderam
- Cartão de **participação** no perfil com check-ins, conversão e badges
  por marcos (Explorador → Embaixador)

### Dashboard — Admin
- CRUD de Vagas (busca, filtros, paginação)
- CRUD de Eventos com **fonte** (Comunidade × Terceiros), aprovação de
  sugestões enviadas por membros/recrutadores, limite de vagas + **lista
  de espera automática** com promoção quando uma vaga libera, métricas
  por evento e **exportação CSV** dos inscritos/check-ins
- Usuários: bloquear/reativar, editar, **resetar senha** para padrão configurável
- Projetos / Squads: capa + **banner separado** (hero da página pública,
  com fallback de gradiente + nome grande quando não há banner; upload com
  validação JPG/PNG/WebP, máx 8MB e redimensionamento automático para
  1920px), busca de membros por nome/e-mail e regra que impede o mesmo
  usuário em mais de um squad por projeto. Na página pública os membros
  aparecem ordenados por **Líder > Cargo no squad > Nome**.
- Depoimentos: aprovar / rejeitar com observação
- Configurações do Site: SEO (prévia Google, Open Graph e **Twitter Card** ao vivo), favicon com validação, histórico de versões com pré-visualização e reversão, hero, contact, about, stats, social_links, footer, newsletter, partners, cta_section, legal, password_policy e mascotes por página
- **Tipografia global**: na aba *Fontes* o admin escolhe fonte de títulos
  e corpo (qualquer Google Font), peso (300–900), itálico, caixa
  (UPPER/lower/Capitalizado), espaçamento entre letras e escala global
  (85%–125%). Inclui **prévia ao vivo no site inteiro** antes de salvar
  e geração automática da URL Google Fonts.
- **Métricas demográficas** (admin/super admin): cartões clicáveis de
  Regiões, Sexo/Gênero e Faixa Etária funcionam como filtros cruzados
  — clique numa barra para filtrar todos os números da tela.
- **Uploader com diagnóstico**: erros de RLS/policy mostram bucket,
  pasta, cargo atual e policy aplicada, com ação rápida para reabrir a
  sessão (erros de auth) ou abrir o guia de permissões (erros de RLS).
- Embaixadores/Admins (`/dashboard/comunidade-perfis`): CRUD de perfis públicos com foto, história profissional, redes e atuação na comunidade
- Mascotes e links sociais podem ser editados em Configurações do Site; `home_content` controla textos das seções da home e `about` controla textos da página Sobre
- **Logs de auditoria** preenchidos automaticamente: criação de usuário
  (`USER_CREATED`), alterações em projetos (`PROJECT_CREATED/UPDATED/
  DELETED`), configurações do site (`SETTING_UPDATED`), submissão e
  moderação de eventos (`EVENT_SUBMITTED`, `EVENT_APPROVED`,
  `EVENT_REJECTED`, `EVENT_CREATED`), check-ins (`EVENT_CHECKIN`) e
  lista de espera (`EVENT_WAITLIST`, `EVENT_WAITLIST_PROMOTED`)

### Dashboard — Super Admin
- Tudo do Admin
- Promover/rebaixar ADMIN
- Política de senha (`password_policy`): senha padrão de reset e validade (em dias)
- Configuração global de uploads (`/dashboard/upload-config`): tamanho máximo, MIME types aceitos e redimensionamento por contexto

### Drops e uploads
- Imagens de drops usam o bucket público `project-covers` no prefixo `drops/`.
- Uploads de drops registram `DROP_IMAGE_UPLOAD_SUCCESS` ou `DROP_IMAGE_UPLOAD_FAILED` em `/dashboard/logs` com usuário, bucket, caminho, arquivo, tipo, tamanho e motivo.
- Uploads de fotos de embaixadores/administradores e mascotes registram `IMAGE_UPLOAD_SUCCESS` ou `IMAGE_UPLOAD_FAILED` com contexto, caminho, tipo, tamanho e detalhe técnico do Supabase.
- Erro RLS 403 agora mostra bucket/prefixo exatos e o diagnóstico consulta a policy real do Storage antes do envio.
- Imagens de configurações do site, mascotes, favicon e perfis públicos usam `project-covers/site/*`; somente ADMIN/SUPER_ADMIN podem gravar nesses caminhos. O dashboard de mascotes tem prévia por item e fallback visual se a imagem quebrar.
- Preço do drop usa máscara BRL e datas usam campo padronizado de calendário para evitar drift de fuso e formatos inválidos.

## Setup

```bash
bun install
bun run dev
```

Variáveis (.env já é populada pelo Lovable Cloud):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
# Server-only:
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Banco de Dados

Tabelas principais: `profiles`, `user_roles`, `jobs`, `events`, `channels`, `faqs`,
`saved_jobs`, `user_event_interests`, `public_site_settings`, `audit_logs`, `lgpd_consents`,
`community_profiles`, `member_feed_posts`.

Funções: `is_admin_or_super`, `has_role`, `handle_new_user`, `promote_user_to_super_admin`, `recalculate_public_home_stats`.

Tabela agregada pública: `public_home_stats` guarda somente totais da home e é atualizada por triggers.

Papéis: `MEMBRO`, `MODERADOR`, `ADMIN`, `SUPER_ADMIN`.

Promover o primeiro SUPER_ADMIN (SQL Editor):

```sql
SELECT public.promote_user_to_super_admin('seu@email.com');
```

## Estrutura

```
src/
  routes/             # File-based routing (TanStack Router)
  components/
    public/           # Componentes da área pública
    dashboard/        # Shell + utilitários do dashboard
    ui/               # shadcn/ui
  integrations/supabase/
    client.ts             # Browser
    auth-middleware.ts    # Server fn auth
    client.server.ts      # Admin (service role)
  lib/
    *.functions.ts    # Server functions (createServerFn)
  styles.css          # Tokens Tailwind v4
```

## Deploy

- **Lovable (recomendado)**: botão Publish (`*.lovable.app`)
- **Cloudflare Workers**: `bun run deploy` (preset Workers em `vite.config.ts`)
- **Vercel**: apenas estáticos. `vercel.json` aponta `outputDirectory: dist/client`.
  Server functions e SSR não rodam neste destino sem migrar o preset.

## Segurança

- RLS em todas as tabelas
- Roles em tabela separada (`user_roles`) com `SECURITY DEFINER` `has_role`
- `community_profiles`: leitura pública apenas de perfis ativos; criação/edição/exclusão só por ADMIN/SUPER_ADMIN
- `member_feed_posts`: leitura e publicação apenas para autenticados; autor remove o próprio post; ADMIN/SUPER_ADMIN moderam
- Server functions sensíveis (reset de senha) usam `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor
- Validação Zod em entradas server-side
- LGPD: `lgpd_consents` com versão de termos

## Licença

Privado — comunidade GALERA DO T.I.
## Nova rodada — Parceiros, Denúncias, Q&A e acesso restrito

- **Eventos da comunidade** agora só aparecem para usuários autenticados (RLS). Eventos de terceiros continuam públicos e, para visitantes anônimos, abrem direto no link externo.
- **Parceiros**: nova área admin em `/dashboard/parceiros` (logo, descrição, site, ordem, ativo). Carrossel autoplay na home pública.
- **Q&A por evento** (`event_questions`): perguntas dos inscritos com moderação por admin (aprovar/rejeitar/responder/apagar). Aprovadas ficam públicas no dialog do evento.
- **Denúncias** (`reports`) em vagas/eventos: botão "Denunciar" nos dialogs públicos, painel admin em `/dashboard/denuncias` com ações "Resolver", "Improcedente" e "Despublicar". Função `resolve_report()` move conteúdo para rascunho, registra audit log e notifica o autor.
- **Métricas de evento** agora incluem coluna de lista de espera e a exportação CSV consolida inscritos + check-ins + waitlist em uma planilha por evento.
- **Sidebar**: link "Explorar Vagas" no menu do membro para voltar à listagem pública sem sair do dashboard.

### Logs de auditoria adicionados
- `REPORT_RESOLVED` / `REPORT_DISMISSED` / `REPORT_UNPUBLISHED`

## Rodada atual — Banners, Responsividade e Auditoria

- **Banner/Capa de eventos** agora é upload (drag & enviar) em vez de URL, tanto no admin (`/dashboard/eventos`) quanto na sugestão de membros (`/dashboard/sugerir-evento`). Aceita JPG/PNG/WebP até 8MB e redimensiona para 1920px automaticamente. Imagens vão para o bucket `project-covers` (pasta `events/`).
- **Sidebar do dashboard em modo modal no mobile/tablet**: em telas < 768px o menu desliza por cima do conteúdo com backdrop e fecha sozinho após clicar em qualquer link (igual a um modal). No desktop continua fixa e colapsável.
- **Responsivo dos cards** (Projetos / Squads / métricas de evento) ajustado para não estourar largura em telas pequenas — grid de KPIs do evento vira 2 colunas no mobile, cards de projeto reduzem altura da capa e usam grid com `min-w-0` para truncar nomes longos.
- **Triggers de auditoria novos** (todos visíveis em `/dashboard/logs`):
  - Vagas: `JOB_CREATED` / `JOB_UPDATED` / `JOB_DELETED`
  - Parceiros: `PARTNER_CREATED` / `PARTNER_UPDATED` / `PARTNER_DELETED`
  - Projetos: `PROJECT_CREATED` / `PROJECT_UPDATED` / `PROJECT_DELETED`
  - Squads: `SQUAD_CREATED` / `SQUAD_UPDATED` / `SQUAD_DELETED`
  - Depoimentos: `TESTIMONIAL_APPROVED` / `TESTIMONIAL_REJECTED`
  - Cargos: `ROLE_GRANTED` / `ROLE_REVOKED` (promoções e rebaixamentos)

## Regras de negócio (resumo executivo)

### Papéis e permissões
| Papel | Pode |
|---|---|
| **MEMBRO** | Editar próprio perfil, salvar vagas, candidatar-se, inscrever-se em eventos, sugerir eventos (passa por aprovação), enviar depoimento (passa por moderação), participar de squads que foi adicionado, postar no mural do projeto, denunciar conteúdo. |
| **RECRUTADOR** (verificado por SUPER_ADMIN) | Tudo de MEMBRO + criar/editar próprias vagas, ver lista de candidatos com filtros, abrir conversas diretas. |
| **MODERADOR** | Aprovar/rejeitar depoimentos e sugestões de evento. |
| **ADMIN** | Tudo acima + CRUD completo de vagas, eventos, parceiros, projetos, configurações do site, denúncias e usuários (bloquear/reativar/resetar senha). |
| **SUPER_ADMIN** | Tudo de ADMIN + promover/rebaixar ADMINs, marcar recrutador como verificado, alterar política de senha e gerenciar squads (membros e líderes). |

### Eventos
- **Fonte** = `comunidade` (destaque na home, visível só para autenticados) ou `terceiros` (público; visitante anônimo vê CTA e clica direto no link externo).
- Eventos sugeridos por MEMBRO/RECRUTADOR entram como `approval_status = pending` e `status = rascunho`; só ADMIN aprova/rejeita.
- Ao aprovar, o evento vira `publicado` automaticamente.
- **Limite de vagas** opcional: ao atingir o limite, novas inscrições entram em **lista de espera** ordenada. Quando alguém cancela, o próximo da fila é promovido e notificado.
- Datas são armazenadas como `DATE` puro e renderizadas em horário local (sem drift de fuso horário).
- Q&A por evento: perguntas dos inscritos passam por moderação; aprovadas viram públicas no dialog.

### Vagas
- Recrutador só edita as próprias vagas. ADMIN edita qualquer uma.
- Candidatura cria notificação para o dono da vaga.
- Visitante anônimo lê vagas mas precisa entrar para se candidatar/salvar.

### Projetos & Squads
- Um **projeto** agrupa um ou mais **squads**.
- Mesmo usuário **não pode estar em dois squads do mesmo projeto** (trigger de banco).
- Só **SUPER_ADMIN** gerencia membros e define líderes (`LIDER` / `MEMBRO`).
- Projeto público gera página em `/projetos/<slug>` com banner próprio, mural de posts e lista de membros (Líder > Cargo > Nome).

### Depoimentos
- Qualquer MEMBRO envia. Entra como `pending`. Só ADMIN aprova/rejeita (com nota opcional). Apenas aprovados aparecem na home.

### Denúncias
- Qualquer autenticado pode denunciar vaga ou evento. ADMIN resolve com: **Resolvida**, **Improcedente** ou **Despublicar** (move para rascunho). Em qualquer caso o autor do conteúdo recebe notificação.

### LGPD
- Cada usuário tem consentimento versionado em `lgpd_consents` (versão dos Termos e da Política de Privacidade), com `consent_origin` (cadastro / banner) e IP mascarado.

### Política de senha
- SUPER_ADMIN define a senha padrão de reset e validade (em dias) em `password_policy`.

### Pendente / próximas sugestões
- Lembretes automáticos 24h/1h antes do evento (precisa configurar Lovable Emails ou push).
- Página pública de parceiros (`/parceiros`) com grid completo, além do carrossel da home.
- Página `/membros/:handle` com perfil público, badges e participação.
- Pesquisa pós-evento (NPS) para inscritos com check-in.
- Editor rico (markdown) para descrição de evento/vaga.

## Rodada atual — Auditoria avançada, Metas, Projetos públicos com solicitação de entrada

### Auditoria (`/dashboard/logs`)
Página reescrita com filtros (usuário, ação, entidade, intervalo de datas, busca textual), paginação (50/página), modal de detalhes e exportação CSV respeitando os filtros aplicados (até 5000 linhas).

### Novos triggers de auditoria
| Ação | Origem |
|---|---|
| `PROJECT_POST_CREATED/DELETED` | mural de projeto |
| `POST_COMMENT_CREATED/DELETED` | comentários do mural |
| `SQUAD_MEMBER_ADDED/REMOVED/ROLE_CHANGED` | gestão de squads |
| `CHANNEL_CREATED/UPDATED/DELETED` | canais |
| `FAQ_CREATED/UPDATED/DELETED` | FAQ |
| `LGPD_CONSENT_RECORDED` | aceite de termos |
| `SQUAD_GOAL_CREATED/UPDATED/DELETED` | metas (admin) |
| `SQUAD_GOAL_COMPLETED/UNCOMPLETED` | conclusão por squad |
| `JOB_APPLIED` | candidatura a vaga |
| `EVENT_INTEREST_REGISTERED` | inscrição em evento |
| `JOIN_REQUEST_CREATED/APPROVED/REJECTED/WAITLIST` | solicitações de entrada |

### Upload de imagens (corrigido)
- Storage policy adicionada para `project-covers/events/*` (membros podem subir banner de evento — antes dava erro de RLS).
- `ImageUploader` agora mostra **progresso**, toasts "Processando → Otimizando → Enviando → Concluído" e mensagens claras: formato inválido informa o tipo recebido, arquivo grande mostra o tamanho real x limite, erros de permissão/MIME/tamanho do servidor são traduzidos.
- Hint padrão exibe extensões aceitas + tamanho máximo em todos os pontos (avatar, capa/banner de projeto, banner de evento).

### Correção de Storage RLS — drops, mascotes, perfis públicos e favicon
- A regra de upload foi centralizada nas funções `can_upload_storage_object` e `can_update_storage_object`, evitando falso bloqueio por RLS ao gravar em `storage.objects`.
- Prefixos administrativos liberados para `ADMIN`/`SUPER_ADMIN`: `project-covers/drops/*` e `project-covers/site/*` (inclui mascotes, favicon e fotos públicas de embaixadores/administradores).
- Avatares seguem restritos a `avatars/<user_id>/*`; eventos continuam em `project-covers/events/*` para usuários autenticados.
- O diagnóstico de upload agora mostra cargo atual, bucket, prefixo, caminho esperado, policy aplicada e teste `can_insert_probe`.
- O upload de favicon usa o mesmo `ImageUploader`, com auditoria (`site_asset`) e erro detalhado quando o Storage negar por RLS.

### Metas com prazo (squad goals)
- Tabelas: `squad_goals` (admin cria) e `squad_goal_completions` (squad marca).
- Admin: botão "Metas" (ícone alvo) em cada projeto em `/dashboard/projetos` — criar/excluir metas com prazo.
- Membro: card "Metas" em `/dashboard/meus-projetos` mostra status por squad, com botão para marcar conclusão. Metas atrasadas ficam destacadas em vermelho.

### Projetos públicos + Solicitação de entrada
- `squads` ganhou `recruiting_status` (`open` / `waitlist` / `closed`). Admin define no card do squad em `/dashboard/projetos`.
- `/projetos` (público) mostra badge **VAGAS ABERTAS / LISTA DE ESPERA / FECHADO** por projeto.
- `/projetos/<slug>` (público) mostra status por squad e botão **"Solicitar entrada"** ou **"Entrar na lista de espera"** com mensagem opcional.
- Nova tabela `project_join_requests` (status pending/approved/rejected/waitlist).
- Líder do squad alvo recebe notificação e vê o pedido em `/dashboard/meus-projetos` (seção "Solicitações de entrada"). Pode **Aceitar**, **Mover para espera** ou **Rejeitar** — aprovar cria o `squad_member` automaticamente.
- Admin/super veem todas as solicitações pendentes no topo de `/dashboard/projetos` e também podem decidir.
- Função RPC `decide_join_request(_id, _action, _note)` faz a transição atômica + log + notificação ao solicitante.

## Atualizações recentes (jun/2026)

### Dashboard › Explorar Projetos (`/dashboard/explorar-projetos`)
Qualquer membro logado vê todos os projetos e seus squads, com badge de recrutamento (`open` / `waitlist` / `closed`).
Solicitações de entrada criadas por aqui ficam marcadas com `source = 'dashboard'`; já as feitas em `/projetos/$slug` (página pública) ficam com `source = 'public_page'`. Ambas geram log `JOIN_REQUEST_CREATED` na auditoria com a origem na descrição.

### Logs de auditoria com filtros no URL
Todos os filtros de `/dashboard/logs` (ação, entidade, usuário, busca, período, página) ficam serializados na query string. Basta copiar o link para refazer a mesma busca depois. A janela de detalhes mostra agora o **contexto da entidade** (nome do projeto, status da vaga, conteúdo do post etc.) — útil antes de exportar o CSV.

### Toasts de aprovação/recusa
O líder de squad recebe `toast.promise` (Aprovando… → Aprovado/Recusado/Espera) com o nome do solicitante e do squad.

## Rodada 25/06 — Upload de Drops, Diagnóstico RLS e Política Global de Upload

### Upload de imagem de drop
- O `ImageUploader` agora trata `403 / row-level security` com mensagem clara: indica o bucket + prefixo (`project-covers/drops/<user>/…`), confirma que é restrito a admin/super admin e sugere reenvio após verificar a sessão.
- Toda tentativa de upload em `/dashboard/drops` (sucesso ou falha) gera um log no audit_logs com a função `log_drop_image_upload_attempt` (entidade `drop_image_uploads`, ações `DROP_IMAGE_UPLOAD_SUCCESS` / `DROP_IMAGE_UPLOAD_FAILED`). O motivo do erro, caminho, tamanho e tipo MIME ficam na descrição para conferir em `/dashboard/logs`.
- Migração reforça a policy de storage (`Admin envia/atualiza/remove imagem de drop`) usando a função `is_admin_or_super` em todas as cláusulas (`USING` e `WITH CHECK`).

### Tela de diagnóstico (admin)
No editor de drops, ao lado de "Adicionar imagem", existe agora um botão **Diagnóstico** que mostra bucket, prefixo, caminho final esperado, tipos aceitos, tamanho máximo, resize ativo e a regra de RLS — útil para descobrir por que um upload pode estar sendo negado **antes** de tentar.

### Política global de upload (SUPER_ADMIN)
Nova página `/dashboard/upload-config` (visível só para SUPER_ADMIN) edita a chave `upload_policy` em `public_site_settings`. Define, por contexto (defaults, avatars, project_covers, event_banners, drop_images, favicon, documents):
- Tamanho máximo (MB)
- Tipos MIME aceitos (PDF/JPEG/PNG/WebP/SVG/ICO/GIF)
- Resize automático (px)

O `ImageUploader` busca esta política em runtime via React Query (chave `upload-policy`, stale 60s), aplicando os limites a avatar, capa/banner de projeto, banner de evento e drops. Mudanças se propagam ao salvar.

### RLS adicional
- `public_site_settings.UPDATE` ganhou condicional: a chave `upload_policy` só pode ser alterada por SUPER_ADMIN; demais settings continuam admin/super.
- `audit_logs` recebeu policies/grants explícitos para INSERT por usuário autenticado (com `auth.uid() = user_id`).

### Sidebar
Item "Config. de Upload" adicionado na seção SUPER ADMIN do menu lateral.

### Upload do banner de evento
- Bucket: `project-covers`, pasta obrigatória: `events/...`.
- Limites: JPG/PNG/WebP, máx 8 MB, otimização automática para 1600px.
- Erros agora exibem detalhe técnico (bucket/folder + mensagem original do Supabase) em vez do genérico “fale com o admin”.

### Configurações públicas (Sobre, Home, SEO…)
A política `UPDATE` em `public_site_settings` ganhou `WITH CHECK (is_admin_or_super(auth.uid()))`, destravando a edição via `/dashboard/configuracoes` para admin/super.

### Mobile
Removido `background-attachment: fixed` no body abaixo de 1024 px — corrige o travamento do scroll vertical no iOS Safari na home.

## Atualizações jun/2026 (parte 2)

### Metas com checklist de tasks
- `squad_goals` ganhou `description` (já existia) e **`tasks jsonb`** — cada item: `{id, title, done, done_by, done_at}`.
- Admin/líder cria/edita metas em `/dashboard/projetos` (modal **Metas**) e gerencia a lista de tasks por meta.
- Em `/dashboard/meus-projetos`, todos os membros do projeto veem a checklist e o progresso `x/y tasks`, mas **somente líderes do squad (ou admin/super) marcam/desmarcam**. O toggle passa pela RPC `toggle_goal_task(_goal_id, _task_id, _done)` que valida permissão e grava log `SQUAD_GOAL_TASK_DONE` / `_UNDONE`.

### Logs de auditoria — sort + CSV com contexto
- `/dashboard/logs` agora persiste **também `sortBy` e `sortDir`** no URL (além de filtros e paginação). Clique nos cabeçalhos `Quando / Usuário / Ação / Entidade` para alternar a ordenação.
- O **CSV de exportação** carrega colunas `ctx_*` com o estado atual da entidade afetada (projetos, squads, eventos, vagas, drops, configurações públicas, etc.), buscadas em batch via `.in('id', ids)`.

### Drops (lançamentos da comunidade)
- Nova área pública `/drops` (no menu do navbar) com listagem de itens publicados, modal de detalhes (galeria, preço, data, formas de pagamento, chave Pix) e botão **"Tenho interesse"**.
- Form de interesse aceita visitante anônimo ou logado; quando logado, pré-preenche nome/email/telefone do `profiles`. Validação Zod (nome ≥ 2, email válido, telefone 8–20 chars, nota ≤ 500).
- Admin/super gerenciam tudo em `/dashboard/drops`: CRUD com `ImageUploader` (bucket `project-covers`, pasta `drops/{user_id}`, JPG/PNG/WebP, até 8 MB), status (`draft` / `published` / `closed`), múltiplas imagens, formas de pagamento (Pix/Crédito/Débito/Transferência/Dinheiro).
- Lista de interessados (modal) com **export CSV** dedicado.
- Tabelas: `drops` e `drop_interests`, ambas com RLS + GRANTs apropriados e triggers `log_drop_changes` / `log_drop_interest` populando `audit_logs` com as entidades `drops` e `drop_interests`.

### Ajustes (jun/2026 — continuação)
- **Sidebar do dashboard reorganizada**: novo grupo `COMUNIDADE` agrupa Meus Projetos, Explorar Projetos, Drops e Depoimentos para todos os perfis. Drops agora aparece no menu de qualquer membro (visualização) e o painel admin permanece restrito em `ADMINISTRAÇÃO`.
- **Modal de detalhes da meta** em `/dashboard/meus-projetos`: clique no título ou em "Detalhes" para abrir descrição completa, prazo e checklist. Líderes (e admins) marcam as tasks; membros só visualizam o progresso.
- **Exclusão segura de Drops**: substituído `confirm()` por `AlertDialog` que mostra o número de interessados cadastrados que serão perdidos e sugere usar o status *Encerrado* como alternativa.
- **Validações reforçadas em Drops**: preço ≥ 0, data de lançamento válida, chave Pix obrigatória quando "Pix" estiver entre as formas de pagamento, telefone do interesse com máscara `(DD) NNNNN-NNNN` e regex de caracteres permitidos.
- **RLS revisada**: `drops` (admin escreve, público lê apenas publicados; admin vê tudo) e `drop_interests` (qualquer pessoa cria; usuário lê só os próprios; admin lê/edita/exclui todos) — sem alterações necessárias.

### Ajustes (jul/2026 — perfil, endereço e usuários)
- **CEP com ViaCEP**: campo CEP no `/dashboard/perfil` agora aplica máscara `00000-000`, dispara consulta debounced (600 ms) ao completar 8 dígitos e ao `onBlur`. Exibe estados distintos para *carregando*, *CEP inválido*, *CEP não encontrado* e *falha de rede*, sempre orientando preencher manualmente.
- **Validação Zod do CEP**: regex `^\d{5}-?\d{3}$` no schema do perfil impede persistir CEP incompleto no Supabase; erro é destacado abaixo do campo.
- **Fallback de UF/região**: quando o ViaCEP devolve payload incompleto (`uf` vazio), o form preserva o estado/região já preenchido e exibe `toast.warning` orientando o usuário a informar manualmente — o salvamento não quebra.
- **Logs**: falhas na consulta ViaCEP são logadas com `console.warn("[perfil] falha na consulta ViaCEP", err)` para inspeção rápida no browser sem quebrar UX.
- **Modal "Ver detalhes" em `/dashboard/usuarios`**: novo CTA `Ver detalhes` em cada linha da tabela abre um dialog com bio, contatos, endereço completo (com região inferida), tecnologias, redes sociais e data de criação. Reaproveita `getGenderLabel` / `getRegionByState` para formatação consistente.

### Ajustes (jul/2026 — continuação: CEP validado, filtros e SEO de perfis)
- **Status de validação do CEP**: coluna `profiles.address_cep_validated_at` (timestamptz). O campo CEP no `/dashboard/perfil` mostra badge `Validado pela ViaCEP` (verde) quando a consulta funcionou, `Informado sem validação` (neutro) quando o usuário digitou algo que não passou pela ViaCEP, e `Consultando ViaCEP…` com spinner `Loader2` enquanto carrega.
- **Revalidação automática no save**: ao salvar o perfil, se o CEP mudou desde a última persistência (ou nunca foi validado), o front chama a ViaCEP de novo antes de gravar. Sucesso atualiza `address_cep_validated_at`; falha zera o campo e loga o motivo.
- **Auditoria ViaCEP**: nova RPC `log_cep_lookup(_cep, _status, _reason, _http_status)` registra em `audit_logs` (entidade `viacep`) toda tentativa — `CEP_LOOKUP_SUCCESS` ou `CEP_LOOKUP_FAILED` com motivos `timeout`, `rate_limit`, `not_found`, `http_XXX`, `viacep_erro_true`, `revalidate_*`. Timeout de 8s via `AbortController`. Admin/super auditam em `/dashboard/logs`.
- **Skeleton no modal Ver detalhes**: `UserDetailDialog` usa `Skeleton` enquanto carrega o perfil completo.
- **Filtros na lista de usuários**: `/dashboard/usuarios` ganhou selects de **Região**, **Sexo** e **Faixa etária** (`Até 17`, `18–24`, `25–34`, `35–44`, `45–54`, `55+`, `Não informado`), somados aos filtros já existentes (busca e cargo). Paginação client-side de 20 itens por página com controles Anterior/Próxima.
- **Admin de Embaixadores/Administradores** (`/dashboard/comunidade-perfis`): busca por nome/cargo, filtro por área (`role_title`), tipo (embaixador/admin) e paginação de 12 cards por página.
- **Páginas públicas `/administradores` e `/embaixadores`**: busca por nome/cargo, filtro por área de atuação e paginação de 9 cards por página. Analytics via `window.dataLayer.push()` + `CustomEvent("community-profile-analytics")` para eventos `community_profile_open`, `community_profile_close`, `community_profile_link_click` e `community_profile_primary_link_click`.
- **JSON-LD dinâmico de perfil**: quando o modal `Saiba mais` abre, o `CommunityProfileCard` injeta um `<script type="application/ld+json">` (schema.org/Person) com `name`, `jobTitle`, `description`, `image` e `sameAs` (links do perfil) — removido ao fechar. Melhora rastreabilidade para crawlers que executam JS.
- **Validação de links no modal**: URLs inválidas (que não passam em `new URL()`) são exibidas como pílula desabilitada com `AlertTriangle` e mensagem `Link indisponível`, evitando cliques em links quebrados. Todos os links agora usam `rel="noopener noreferrer"`.
