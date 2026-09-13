# Status Vercel / GitHub — diagnóstico (13/09/2026)

## Resumo

| Item | Estado |
|---|---|
| Pull requests abertos no GitHub | **Nenhum** — todos os PRs (#1–#14) estão **MERGED** |
| Código em `main` | Completo (app CRM + MCP + `vercel.json` + docs) |
| `https://crm-fled.vercel.app` | **HTTP 500** — projeto permanente sem env vars no dashboard |
| Deploy temporário (ex.: `temporary-brisk-sitar-u8c9hyv`) | **HTTP 200** no `/login` — app sobe com envs injetadas no build |
| Commit status no GitHub | **Vercel: Deployment failed** apontando para o projeto **`temporary-prompt-oxygen-jth60j7`** |

Não há conflito de merge no GitHub. O “conflito” que aparece na Vercel/GitHub é de **projeto errado ligado ao repositório** + **produção permanente sem variáveis de ambiente**.

## O que está acontecendo

1. Deploys temporários de agentes Cursor criaram projetos com nome `temporary-*`.
2. Um deles (`temporary-prompt-oxygen-jth60j7`) ficou conectado ao repo `LevyOliveirabr/crm` e tenta fazer Production a cada push em `main`.
3. Esse build falha → o commit ganha o X vermelho “Deployment has failed” no GitHub.
4. O projeto definitivo **`crm-fled`** (time `levyoliveirabrs-projects`) está no ar em `https://crm-fled.vercel.app`, mas sem as 5 env vars no painel → runtime **500**.
5. O token MCP/OAuth do agente **não tem escopo** nesse time (`403 Not authorized` em `levyoliveirabrs-projects` / `team_2kJ6XpYJwTHcgs08izkDaId6`), então o agente **não consegue** setar env vars nem religar o Git sozinho.

## Correção (faça no dashboard Vercel — ~5 min)

### A) Consertar `crm-fled` (produção real)

1. Abra [vercel.com/levyoliveirabrs-projects/crm-fled](https://vercel.com/levyoliveirabrs-projects/crm-fled) (ou busque `crm-fled` no dashboard).
2. **Settings → Environment Variables** → Environment = **Production** (e Preview se quiser):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://owgbgrksfwdiftdfapdm.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public (Supabase → Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (**só servidor**) |
| `SUPABASE_JWT_SECRET` | JWT Secret (Settings → API) — obrigatório para MCP |
| `APP_URL` | `https://crm-fled.vercel.app` |

3. **Deployments → … no deployment atual → Redeploy** (sem “Use existing Build Cache” se quiser garantir).
4. Confirme: `https://crm-fled.vercel.app/login` → **200**, não 500.

### B) Remover o conflito do projeto temporário

1. Em Vercel, abra o projeto `temporary-prompt-oxygen-jth60j7` (e outros `temporary-*` ligados ao mesmo repo, se houver).
2. **Settings → Git** → **Disconnect** do repositório `LevyOliveirabr/crm`, **ou** delete o projeto temporário.
3. Em **`crm-fled` → Settings → Git**: confirme que está conectado a `LevyOliveirabr/crm`, production branch = `main`.
4. Faça um push vazio ou Redeploy: o status no GitHub deve voltar a verde no projeto `crm-fled`.

### C) Supabase Auth (se login falhar após o 500 sumir)

Authentication → URL Configuration:

- **Site URL:** `https://crm-fled.vercel.app`
- **Redirect URLs:**  
  `https://crm-fled.vercel.app/auth/callback`  
  `https://crm-fled.vercel.app/auth/definir-senha`

## Como validar depois

```bash
curl -sI https://crm-fled.vercel.app/login   # esperado: HTTP 200
```

Smoke test: `docs/checklist-producao.md`.

## Relação com o GitHub

- **Não precisa de PR aberto** para publicar: a `main` já tem o código.
- O X vermelho nos commits **não** significa conflito de código; significa build falho no projeto Vercel temporário.
- Detalhes de publicação: `docs/publicar-producao.md` e `docs/deploy-producao.md`.
