# Deploy em produção (etapa 09)

Guia operacional alinhado à SPEC seções 2 e 8 (entrega 1). Sem funcionalidades novas — só publicar o que já está commitado.

## Estado do build

- `npm run build` local: OK (TypeScript sem erros).
- Sem uso de `fs` / `node:fs` em rotas; nada marcado como `runtime = "edge"`.
- `vercel.json` define framework Next.js e região `gru1` (São Paulo).

## 1. Importar o repositório na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) com a conta que já tem o GitHub conectado.
2. Importe `LevyOliveirabr/crm` (repositório privado).
3. Framework: **Next.js** (auto). Root: `/`.
4. Confirme que o projeto lê o `vercel.json` (região `gru1`).
5. **Não** faça o primeiro deploy ainda — configure as variáveis primeiro.

## Status atual (etapa 09)

- **URL de produção:** https://crm-fled.vercel.app
- **Projeto Vercel:** `crm-fled` (time `levyoliveirabrs-projects`), região preferida `gru1` via `vercel.json` (deploy por arquivos ainda pode buildar em `iad1`).
- **Build:** branch `cursor/etapa-09-deploy-producao-7d08` (entregas 01–08 mescladas + este guia).
- `/login` responde **HTTP 200**.
- O MCP não consegue gravar Environment Variables no time (escopo). As envs foram injetadas no build via `.env.production` no `installCommand` — **ainda configure as 5 variáveis no dashboard** para deploys futuros e runtime estável.

## 2. Variáveis de ambiente (Production)

Copie os mesmos valores de `.env.local`, trocando só `APP_URL`:

| Variável | Onde pegar | Produção |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | igual ao local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (anon public) | igual ao local |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (service_role) — **só server** | igual ao local |
| `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Secret | igual ao local |
| `APP_URL` | URL final do app | `https://crm-fled.vercel.app` |

No dashboard: Project → Settings → Environment Variables → Environment = **Production** (e Preview se quiser). Depois de salvar, faça **Redeploy**.

## 3. Deploy

1. Preferível: linkar o GitHub `LevyOliveirabr/crm` ao projeto `crm-fled` no dashboard (Deployments → Connect Git Repository) para deploy automático na `main`.
2. URL atual: `https://crm-fled.vercel.app`.
3. Se `APP_URL` mudar (domínio custom), atualize a env e **redeploy**.

## 4. Supabase Auth (obrigatório pós-deploy)

Supabase → Authentication → URL Configuration:

- **Site URL** = `https://crm-fled.vercel.app`
- **Redirect URLs** (adicione, não remova o localhost se ainda usar local):
  - `https://crm-fled.vercel.app/auth/callback`
  - `https://crm-fled.vercel.app/auth/definir-senha`
  - `http://localhost:3000/auth/callback` (dev)
  - `http://localhost:3000/auth/definir-senha` (dev)

## 5. Checklist de fumaça

Siga `docs/checklist-producao.md` (12 testes + pós-importação).

## 6. Importação da base real

Quando os CSVs forem indicados:

1. Login como **diretor** em produção.
2. `/configuracoes` → importação CSV (ordem da SPEC seção 6).
3. Conferir contagens vs arquivo.
4. Validar relatório da presidência.

## Troubleshooting rápido

- Build falha na Vercel e passa local → falta variável (as 5).
- Login só local → Site URL / Redirect no Supabase.
- 500 em Server Action → Vercel Logs; RLS / client errado (nunca trocar para service role nas telas).
