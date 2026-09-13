# Publicar o CRM F-Led em produção (Vercel)

## Opção rápida (temporário → permanente)

1. Abra o link do app temporário e teste o login.
2. Abra o **Claim Deployment** logado na sua conta Vercel.
3. Escolha o time **levyoliveirabrs-projects** (ou pessoal).
4. Depois do claim, o app fica permanente no dashboard: https://vercel.com/dashboard

## Opção recomendada (GitHub → Vercel, produção real)

1. No Vercel: **Add New… → Project → Import** o repositório `LevyOliveirabr/crm`.
2. Framework: **Next.js**. Region: **São Paulo (gru1)** se aparecer.
3. Em **Environment Variables** (Production), cadastre:

```
NEXT_PUBLIC_SUPABASE_URL=https://owgbgrksfwdiftdfapdm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua anon key>
SUPABASE_SERVICE_ROLE_KEY=<sua service role key>
SUPABASE_JWT_SECRET=<seu jwt secret>
APP_URL=https://SEU-DOMINIO.vercel.app
```

4. Deploy em **Production** (branch `main`).
5. No Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://SEU-DOMINIO.vercel.app`
   - Redirect URLs:  
     `https://SEU-DOMINIO.vercel.app/auth/callback`  
     `https://SEU-DOMINIO.vercel.app/auth/definir-senha`
6. (Opcional) Domínio próprio em Vercel → Project → Domains.
7. Smoke test: login, Hoje, Funil, Nova negociação, Configurações.

## Login inicial

Use um usuário diretor já criado no Supabase Auth (ex.: `levyoliveirabr@gmail.com`).
