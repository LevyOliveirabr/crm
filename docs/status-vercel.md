# Status Vercel / GitHub — atualizado (19/09/2026)

## Resumo rápido

| Item | Estado |
|---|---|
| Repositório GitHub | `https://github.com/LevyOliveirabr/crm` |
| Branch publicada | `main` |
| Commit em produção | `1d63d82` |
| Projeto Vercel | `crm-fled` (`levyoliveirabrs-projects`) |
| URL de produção | `https://crm-fled.vercel.app` |
| Status do deploy | `Ready` |

## Publicação realizada

Em 19/09/2026, o projeto `crm-fled` foi publicado em produção sem alteração de código da aplicação.

O erro HTTP 500 em produção era causado por variáveis de ambiente incompletas no Vercel. O build já passava, mas o runtime falhava ao criar o client do Supabase.

Variáveis confirmadas no ambiente **Production** do Vercel:

| Variável | Tipo no Vercel |
|---|---|
| `APP_URL` | Config |
| `NEXT_PUBLIC_SUPABASE_URL` | Config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret |
| `SUPABASE_JWT_SECRET` | Secret |

Depois da configuração, foi feito redeploy de produção:

- Deployment: `dpl_B49hYqaSgk1dESuW6Bt7doWfn52P`
- URL do deployment: `https://crm-fled-83t72wwp5-levyoliveirabrs-projects.vercel.app`
- Alias de produção: `https://crm-fled.vercel.app`

## Validação realizada

Testes de fumaça após o redeploy:

| Rota | Resultado |
|---|---|
| `/` | HTTP 307 para login |
| `/login` | HTTP 200 |
| `/api/mcp/mcp` | HTTP 401 sem token, esperado para endpoint protegido |

Logs recentes do Vercel após os testes:

- Sem erros recentes reportados por `vercel logs https://crm-fled.vercel.app --since 3m`.

## Observações operacionais

As chaves reais do Supabase não foram gravadas no repositório. Elas ficam somente nas variáveis de ambiente do Vercel.

Para novas publicações, mantenha o deploy ligado à branch `main` e confirme que as cinco variáveis acima continuam presentes no ambiente **Production**.

Manual do sistema + MCP/Grok: `docs/manual-utilizacao.md`.
