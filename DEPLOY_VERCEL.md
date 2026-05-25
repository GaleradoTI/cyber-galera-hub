# Deploy na Vercel — GALERA DO T.I.

Este projeto roda na Lovable usando o preset **Cloudflare Workers**
(via `@lovable.dev/vite-tanstack-config`). Para publicar na Vercel é
preciso trocar o target do TanStack Start. Faça os passos abaixo
**depois de exportar o repositório para o GitHub**, fora da Lovable.

## 1. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Nome                              | Valor                                   |
| --------------------------------- | --------------------------------------- |
| `VITE_SUPABASE_URL`               | `https://miqzcsrddtlifzzmhokz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | (publishable / anon key)                |
| `VITE_SUPABASE_PROJECT_ID`        | `miqzcsrddtlifzzmhokz`                  |
| `SUPABASE_URL`                    | igual ao VITE_SUPABASE_URL              |
| `SUPABASE_PUBLISHABLE_KEY`        | igual ao VITE_SUPABASE_PUBLISHABLE_KEY  |
| `SUPABASE_SERVICE_ROLE_KEY`       | (service role — **NUNCA** prefixar VITE_) |

## 2. Trocar o preset para Vercel

No `package.json`, instale o adapter oficial:

```bash
bun add -D @vercel/node
```

Substitua o `vite.config.ts` por uma versão **sem** o wrapper Lovable:

```ts
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ target: "vercel" }),
    viteReact(),
  ],
});
```

Remova `wrangler.jsonc` e simplifique `src/server.ts` (não é mais
necessário o wrapper de Cloudflare — o `tanstackStart` cuida disso no
target `vercel`).

## 3. `vercel.json`

Já incluso na raiz. Faz fallback de rotas SPA para o entry SSR gerado.

## 4. Deploy

```bash
vercel link
vercel --prod
```

## 5. Criar o primeiro SUPER_ADMIN

1. Cadastre-se normalmente em `/cadastro` no site publicado.
2. No Supabase Dashboard → **SQL Editor**, execute:

```sql
SELECT public.promote_user_to_super_admin('seu@email.com');
```

3. Faça logout/login. O dashboard passa a exibir o badge **SUPER ADMIN**
   e o painel administrativo completo.

> A função `promote_user_to_super_admin` só é executável pelo service
> role (SQL Editor / Dashboard) — usuários autenticados não conseguem
> chamá-la pela API.