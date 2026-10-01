# Eventos: programação, inscrição com aprovação, QR Code e crachá

## O que muda para o usuário

**Página do evento (novo design)**
- Página própria por evento (`/eventos/<id>`) com capa, data, endereço com botão "Abrir no mapa", link online e descrição bem formatada.
- **Programação (grade)**: lista de horários em linha do tempo — início/fim, título da atividade, palestrante e sala/trilha.
- Botão **"Quero ir"** (exige login) com status visível: Pendente, Aprovado, Recusado, Lista de espera.

**Aprovação pelos admins**
- No painel de Eventos, aba **Inscrições** por evento: aprovar/recusar individualmente ou em lote, filtros por status, busca e exportação CSV.
- Limite de vagas respeitado; ao recusar/cancelar, a lista de espera avança.
- Usuário recebe notificação quando é aprovado.

**Ingresso com QR Code**
- Após aprovação, o participante vê em "Meus eventos" o ingresso com **QR Code + código curto** (ex.: `GTI-7KQ2-M9`) para apresentar no dia.
- Participante pode cancelar a presença.

**Check-in no dia**
- Tela de check-in para admins: leitura do QR pela câmera do celular ou digitação do código; mostra nome/foto e confirma presença (avisa se já fez check-in ou não está aprovado).
- Contador ao vivo: aprovados x presentes.

**Crachás**
- Gerar crachás dos aprovados (nome, cargo/área, evento, QR) em página pronta para imprimir/salvar em PDF, vários por folha.

**Admin – edição do evento**
- Editor da programação (adicionar/remover/reordenar horários) e campo "exige aprovação" (sim/não; se não, a inscrição já entra aprovada).

## Detalhes técnicos
- Nova tabela `event_registrations` (event_id, user_id, status pending/approved/rejected/waitlist/cancelled, ticket_code único, approved_by/at, checked_in_at) com GRANTs + RLS (dono vê o seu; admin gerencia tudo).
- `events`: colunas `schedule jsonb` (itens {start,end,title,speaker,room}), `requires_approval boolean`, `end_time`.
- RPCs SECURITY DEFINER: `register_for_event`, `decide_registration`, `checkin_by_code` (admin), com auditoria e notificação.
- `event_checkins` passa a ser alimentada pelo check-in por código; `user_event_interests` continua para compatibilidade.
- Libs: `qrcode` (gerar) e `html5-qrcode` (ler câmera, carregado só no navegador).
- README e logs atualizados.
