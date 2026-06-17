## Escopo

Vou atacar em uma única leva os 10 pontos que você listou. Cada bloco abaixo é independente e pode ser revisado separadamente.

### 1. Projetos visíveis para membros + solicitar entrada (dentro do dashboard)
- Criar nova rota `src/routes/dashboard.explorar-projetos.tsx` mostrando **todos** os projetos (independentemente de ser membro), com:
  - Status do projeto, lista de squads com badge de `recruiting_status` (aberto / lista de espera / fechado).
  - Botão "Solicitar entrada" por squad — desabilitado quando `closed`, abre dialog com mensagem opcional, gravando em `project_join_requests` (já existe). Quando o usuário já é membro do squad, mostrar "Você já participa".
- Adicionar item "Explorar projetos" no menu lateral (`dashboard-shell.tsx`) visível para todos os papéis.

### 2. Filtros de `/dashboard/logs` no URL
- Migrar a página para `validateSearch` com `zodValidator` (action, entity, user, search, from, to, page).
- Ler estado de `Route.useSearch()` e atualizar via `navigate({ search: ... })` em vez de `useState` — assim recarregar/voltar mantém a busca.

### 3. Detalhes do log por entidade
- Reescrever o `Dialog` de detalhes para renderizar painel específico por `entity`:
  - `projects` / `squads` / `squad_members` / `project_join_requests`: buscar o registro relacionado (nome do projeto, squad, papel, status) via `supabase.from(...).select(...).eq('id', entity_id)`.
  - `events`, `jobs`, `partners`, `channels`, `faqs`, `testimonials`: mostrar título, status e link para a entidade.
  - `public_site_settings`: comparar `site_settings_history` (versão anterior x atual).
  - Fallback genérico para entidades sem handler.

### 4. Toast para líder ao aprovar/recusar entrada
- Em `dashboard.meus-projetos.tsx` envolver a chamada de `decide_join_request` com `toast.promise` mostrando "Aprovando…" → "Aprovado: <usuário> entrou em <squad>" / "Recusado". Refetch da lista após sucesso.
- Mesma melhoria no painel admin em `dashboard.projetos.tsx`.

### 5. Logs nas páginas públicas `/projetos` e `/projetos/$slug`
- A entrada já é gravada pelo trigger `log_join_request_insert` (entity = `project_join_requests`). Vou adicionar `metadata` opcional indicando origem (`public_page` vs `dashboard`) usando uma coluna nova `source text` em `project_join_requests` para diferenciar — e ajustar o trigger para incluir essa origem na descrição.
- Garantir que o botão público em `projetos.index.tsx` e `projetos.$slug.tsx` envia `source: 'public_page'`.

### 6. Upload do banner do evento dando erro "fale com admin"
- A mensagem genérica vem do `ImageUploader` quando o Supabase retorna RLS error. Hoje a policy do bucket `project-covers` exige caminho `events/...` mas o uploader em `dashboard.sugerir-evento.tsx`/`dashboard.eventos.tsx` está passando `folder` diferente. Vou:
  - Padronizar o `folder` para `events/{user_id}` nesses dois lugares.
  - Revisar a policy de INSERT/UPDATE em `storage.objects` para `project-covers` aceitando `(storage.foldername(name))[1] = 'events'` para `authenticated`.
  - Exibir o erro real (`upErr.message`) no toast quando não bater nenhum padrão conhecido, em vez de só "fale com admin".

### 7. Edição da área pública (sobre, home, seo) não salva
- A tabela `public_site_settings` só permite update para admin/super. Vou:
  - Auditar policies — provavelmente falta `WITH CHECK` no UPDATE ou está restringindo por `setting_key`.
  - Conferir a página de configurações; se estiver chamando `.upsert()` sem `onConflict: 'setting_key'`, ajustar.
  - Garantir que o trigger `log_site_setting_change` não falha por NULL em `auth.uid()` durante SSR.

### 8. README + lista de actions de log
- Atualizar `README.md` com:
  - Nova rota "Explorar projetos".
  - Nova coluna `source` em join requests.
  - Fluxo correto de upload de banner.
  - Como editar conteúdo público (rota, papéis necessários).

### 9. Scroll travado no mobile (home)
- Investigar `src/routes/index.tsx`, `hero.tsx`, `stats-section.tsx`. Provável causa: `overflow-hidden` no body/`<main>` ou seção com `100vh` + `overflow-hidden` capturando o gesto. Corrigir removendo `overflow-hidden` no wrapper externo e garantindo `min-h-screen` em vez de `h-screen`.

### 10. "Ajustar os erros"
- Rodar `tsc`/build após cada bloco; consertar imports quebrados, tipos do `types.ts` desatualizados depois das migrações e qualquer warning aparente em `console`. Como esta linha é genérica, vou focar nos erros que surgirem durante as mudanças acima — se você tiver um erro específico em mente (mensagem, página), me diga que eu trato dedicado.

## Migrações SQL necessárias
1. `ALTER TABLE public.project_join_requests ADD COLUMN source text DEFAULT 'dashboard';`
2. Atualizar `log_join_request_insert` para incluir `source` na descrição.
3. Policies do bucket `project-covers` (INSERT/UPDATE) para `authenticated` na pasta `events/`.
4. Revisar/ajustar policies de UPDATE em `public_site_settings`.

## Ordem de execução
1. Migração SQL (ponto 5, 6, 7).
2. Frontend: explorar projetos, logs com URL, detalhes ricos, toasts, upload, configurações públicas.
3. Mobile home.
4. README + verificação de build.

Confirma que posso seguir nessa ordem? Se quiser priorizar/recortar (por exemplo: só os pontos 6, 7 e 9 primeiro porque estão bloqueando), me diga antes de eu rodar a migração.