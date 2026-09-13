# Status Vercel / GitHub — atualizado (13/09/2026)

## Resumo rápido

| Item | Estado |
|---|---|
| GitHub ↔ projeto **`crm-fled`** | **Conectado** (confirmado pelo usuário) |
| Código em `main` (antes deste PR) | Tinha **arquivos corrompidos por merge** (build quebrava) |
| Este PR | **Corrige o build** + manual + diagnóstico |
| `https://crm-fled.vercel.app` | Ainda **HTTP 500** até cadastrar as **5 env vars** e Redeploy |
| Deploy temporário válido (~1h) | https://temporary-snappy-antimony-iztfiki.vercel.app → `/login` **200** |
| Claim do temporário | https://vercel.com/claim-deployment?code=c9a463cc-1527-46b6-8c67-4ac16ffc6108 |

## O que já foi feito neste agente

1. Diagnóstico: não havia conflito de PR; o X no GitHub vinha do projeto `temporary-*` e/ou build quebrado.
2. **Build corrigido**: páginas e libs mescladas/duplicadas restauradas (`empresas`, `contatos`, `relatorios`, `config`, `globals.css`, etc.). `npm run build` passa.
3. Deploy temporário anônimo com as env vars injetadas — app sobe.
4. MCP OAuth do agente **ainda sem escopo** no time `levyoliveirabrs-projects` → **não consegue** gravar env vars no `crm-fled` pela API.

## O que falta no dashboard (você — ~3 min)

### 1) Env vars no `crm-fled`

Vercel → projeto **crm-fled** → **Settings → Environment Variables** (Production + Preview):

| Variável | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | API → `service_role` (**secret**) |
| `SUPABASE_JWT_SECRET` | API → JWT Secret |
| `APP_URL` | `https://crm-fled.vercel.app` |

Depois: **Deployments → Redeploy** (ou merge deste PR na `main` para disparar deploy automático via Git).

### 2) Desligar o projeto temporário antigo (se ainda aparecer X no GitHub)

Em qualquer `temporary-prompt-oxygen-*` (ou similar) ligado ao repo: **Settings → Git → Disconnect**, ou delete o projeto. Só o **`crm-fled`** deve estar conectado a `LevyOliveirabr/crm`.

### 3) Supabase Auth URLs

- Site URL: `https://crm-fled.vercel.app`
- Redirects:  
  `https://crm-fled.vercel.app/auth/callback`  
  `https://crm-fled.vercel.app/auth/definir-senha`

## Validação

```bash
curl -sI https://crm-fled.vercel.app/login   # esperado: HTTP 200
```

Enquanto isso, use o temporário acima (ou faça o claim).

Manual do sistema + MCP/Grok: `docs/manual-utilizacao.md`.
