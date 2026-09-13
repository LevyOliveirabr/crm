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

> **Bloqueio atual do agente:** `create_git_project` e leitura de deployments no time `levyoliveirabrs-projects` retornam **403** (escopo do time). Um projeto `crm-fled` pode já existir no time a partir de um deploy de teste — **não use esse deploy** até o repositório GitHub estar linkado e as 5 variáveis corretas. Faça o import/link pelo dashboard (passos acima) e confirme as envs com os **mesmos nomes** de `.env.local`.

## 2. Variáveis de ambiente (Production)

Copie os mesmos valores de `.env.local`, trocando só `APP_URL`:

| Variável | Onde pegar | Produção |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | igual ao local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (anon public) | igual ao local |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (service_role) — **só server** | igual ao local |
| `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Secret | igual ao local |
| `APP_URL` | URL final do app | `https://<projeto>.vercel.app` (ou domínio custom) |

No dashboard: Project → Settings → Environment Variables → Environment = **Production** (e Preview se quiser).

## 3. Deploy

1. Deploy Production (branch `main` ou a branch de release).
2. Anote a URL (ex.: `https://crm-fled.vercel.app`).
3. Se `APP_URL` ainda estava placeholder, atualize e **redeploy**.

## 4. Supabase Auth (obrigatório pós-deploy)

Supabase → Authentication → URL Configuration:

- **Site URL** = `https://<dominio-producao>`
- **Redirect URLs** (adicione, não remova o localhost se ainda usar local):
  - `https://<dominio-producao>/auth/callback`
  - `https://<dominio-producao>/auth/definir-senha`
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
