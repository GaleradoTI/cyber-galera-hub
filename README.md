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
- Home com hero, estatísticas e CTA configuráveis
- Vagas, Eventos, Canais, FAQ, Sobre, Termos, Privacidade
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
- Configurações do Site: SEO (prévia Google, Open Graph e **Twitter Card** ao vivo), favicon com validação, histórico de versões com pré-visualização e reversão, hero, contact, about, stats, social_links, footer, newsletter, partners, cta_section, legal, password_policy
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
`saved_jobs`, `user_event_interests`, `public_site_settings`, `audit_logs`, `lgpd_consents`.

Funções: `is_admin_or_super`, `has_role`, `handle_new_user`, `promote_user_to_super_admin`.

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
