## Onda 4 — escopo grande, separado por blocos

### Bloco A — Vitrine pública de projetos (corrige feedback)
- Nova rota `/projetos` (listagem) no menu público do site (junto de Vagas, Eventos, Canais, FAQ).
- Card por projeto público: capa, nome, descrição curta, tech_stack, link → `/projetos/$slug`.
- Refinar `/projetos/$slug`: hero com capa, animação de entrada suave, skeletons enquanto carrega, layout 100% responsivo (mobile-first), botões de compartilhar.
- Adicionar link "Projetos" no `NAV_LINKS` (site-config) e no footer.

### Bloco B — Dashboard Home renovado (fechando Onda 3, feature 4)
- `/dashboard` (`dashboard.index.tsx`) por perfil:
  - **Membro**: vagas casadas (match por tech_tags), candidaturas em andamento, próximos eventos.
  - **Recrutador**: funil (enviadas/em análise/contratado/rejeitada), candidatos novos na semana, atalho criar vaga.
  - **Admin/Super**: KPIs (usuários ativos, vagas publicadas, projetos ativos, eventos próximos).
- Cards com skeleton loading, animação fade-in.

### Bloco C — Feature 5: Exportação CSV de candidatos
- Botão "Exportar CSV" em `/dashboard/candidatos`.
- Gera CSV client-side com nome, email, vaga, status, data. Respeita filtro atual.

### Bloco D — Feature 6: Match inteligente
- Em `/vagas` e detalhe da vaga: para usuário logado com `tech_tags`, calcular % de aderência (intersecção / union × 100).
- Badge "85% match" colorido por faixa (verde >70, amarelo 40–70, cinza <40).
- Em `/dashboard/candidatos`: mostrar % match do candidato com a vaga.

### Bloco E — Feature 7: Eventos por squad
- Nova migração: `squad_events` (squad_id, name, description, event_date, event_time, location_or_link, created_by). RLS: só membros do squad e admins veem; líder do squad cria/edita.
- UI em `/dashboard/meus-projetos` (aba "Eventos do squad") para listar/criar.

### Bloco F — Feature 9: Busca global (Ctrl+K)
- Componente `CommandPalette` usando `cmdk` (já existe `command.tsx`).
- Atalho `Ctrl/Cmd+K` no shell do dashboard.
- Indexa: vagas (publicadas), projetos (membro), usuários (admin), eventos.

### Bloco G — Feature 14: AI helper (Lovable AI Gateway)
- Server fn `ai-helper.functions.ts` usando `LOVABLE_API_KEY` (já em secrets) com modelo `google/gemini-2.5-flash`.
- Botão "✨ Gerar com IA" em:
  - `/dashboard/vagas` editor → gera descrição a partir de título + tech.
  - `/dashboard/perfil` → sugere `tech_tags` a partir da bio.
- Streaming opcional — versão inicial sem stream (resposta completa).

### Bloco H — Segurança e privacidade
1. **Senhas no banco**: confirmar que o app NÃO armazena senha em tabela própria — autenticação é 100% via Supabase Auth (`auth.users`, gerenciado pela plataforma). Documentar em `security memory`.
2. **JSON / colunas sensíveis**:
   - `profiles` hoje tem RLS bem restrita (dono, admin, recrutador-quando-looking) — OK. Mas o select padrão expõe `email` para recrutador. Vou criar view `public_profiles` sem `email/social_links/is_blocked` e atualizar a página pública do projeto e listagens públicas para usar a view.
   - `/projetos/$slug`: hoje busca `profiles.*` direto via JS — limitar a `display_name, avatar_url` via view pública.
   - `audit_logs`, `lgpd_consents`, `user_roles` — já restritos a admin/dono, OK.
3. **Validação de input** (Zod) nos server fns novos (AI helper, exportação).
4. **Rate limit leve** no AI helper (1 req / 5s por usuário, em memória do worker — best effort).

---

## Detalhes técnicos

- TanStack Router (rotas em `src/routes/`), Supabase JS, Tailwind tokens.
- Página pública usa client supabase (anon) + RLS já permite (`is_public=true`).
- AI Helper via `https://ai.gateway.lovable.dev/v1/chat/completions` com header `Authorization: Bearer ${LOVABLE_API_KEY}` em server fn.
- CSV: blob client-side, sem servidor.
- Match: calculado client-side (sem custo extra de query).

---

## Sugestões pós-entrega

- **Compartilhamento social**: og:image dinâmico por projeto público.
- **Convites por e-mail** (recrutador convida candidato direto pra vaga).
- **Histórico de conversas** persistido com search por palavra-chave.
- **Modo escuro/claro** (hoje só dark).
- **Onboarding guiado** no primeiro login.
- **Webhook Discord/Slack** quando vaga é publicada.

---

## Ordem
Faço tudo numa sequência só: migração (squad_events + view public_profiles) → frontend dos blocos A–G → segurança/limpeza no final. Confirma?
