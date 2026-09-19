# CRM Comercial F-Led

CRM comercial (Next.js + Supabase) para a F-Led: Hoje, Funil, Empresas, Contatos, Relatório da Presidência e servidor **MCP** para agentes (Cursor, Claude, Grok).

## Links

- **Produção:** https://crm-fled.vercel.app  
  (se retornar 500, veja `docs/status-vercel.md`)
- **Manual de uso + MCP/Grok:** [`docs/manual-utilizacao.md`](docs/manual-utilizacao.md)
- **Status Vercel / GitHub:** [`docs/status-vercel.md`](docs/status-vercel.md)
- **MCP (Cursor/Claude/Grok):** [`docs/mcp.md`](docs/mcp.md)
- **Criar um agente que conversa com o CRM:** [`docs/manual-agente-mcp.md`](docs/manual-agente-mcp.md)
- **Deploy:** [`docs/deploy-producao.md`](docs/deploy-producao.md)
- **Especificação:** [`SPEC.md`](SPEC.md)

## Desenvolvimento local

```bash
cp .env.local.example .env.local
# preencha as 5 variáveis (Supabase + APP_URL)

npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) · TypeScript · Tailwind/shadcn · Supabase (Auth + Postgres + RLS) · MCP Streamable HTTP · Deploy Vercel (`gru1`).
