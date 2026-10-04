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

## Login com Google (configuração única)

O botão "Entrar com Google" usa o provider Google do Supabase Auth. Não há código extra a configurar; só os painéis:

1. **Google Cloud Console** → APIs e Serviços → Credenciais → Criar ID do cliente OAuth (tipo "Aplicativo da Web").
   - Origens JavaScript autorizadas: `https://crm-fled.vercel.app` e `http://localhost:3000`.
   - URI de redirecionamento autorizado: `https://<ref-do-projeto>.supabase.co/auth/v1/callback`.
   - Configure a tela de consentimento (nome do app, e-mail de suporte).
2. **Supabase** → Authentication → Sign In / Providers → Google: ativar e colar Client ID e Client Secret.
3. **Supabase** → Authentication → Sign In / Providers → **desligar "Allow new users to sign up"**. Isso garante que só e-mails convidados pelo diretor conseguem entrar com Google (o convite via Admin API continua funcionando).
4. **Supabase** → Authentication → URL Configuration → Redirect URLs: incluir `https://crm-fled.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`.

## Stack

Next.js (App Router) · TypeScript · Tailwind/shadcn · Supabase (Auth + Postgres + RLS) · MCP Streamable HTTP · Deploy Vercel (`gru1`).
