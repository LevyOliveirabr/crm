# Supabase Auth — URLs de produção (obrigatório)

O e-mail de “esqueci senha” / convite usa o **Site URL** do Supabase.
Se estiver `http://localhost:3000`, o link do e-mail abre a máquina local
mesmo com o app publicado em `https://crm-fled.vercel.app`.

## O que configurar (2 minutos)

1. Abra o projeto Supabase: https://supabase.com/dashboard/project/owgbgrksfwdiftdfapdm  
2. **Authentication** → **URL Configuration** (ou “URLs”)  
3. Preencha:

### Site URL
```text
https://crm-fled.vercel.app
```

### Redirect URLs (adicione todas)
```text
https://crm-fled.vercel.app/auth/callback
https://crm-fled.vercel.app/auth/definir-senha
https://crm-fled.vercel.app/**
http://localhost:3000/auth/callback
http://localhost:3000/auth/definir-senha
http://localhost:3000/**
```

4. **Save**

## Depois

1. Peça um **novo** e-mail em https://crm-fled.vercel.app/login/esqueci-senha  
2. O link deve começar com `https://crm-fled.vercel.app/...`  
3. **Não use** o e-mail antigo (ainda aponta para localhost)

## Sintoma típico

- Link recebido: `http://localhost:3000/?code=...` → Site URL ainda é localhost  
- Link correto: `https://crm-fled.vercel.app/?code=...` ou `.../auth/callback?code=...`
