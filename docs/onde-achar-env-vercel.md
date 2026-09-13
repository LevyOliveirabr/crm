# Como achar as Environment Variables no Vercel (crm-fled)

Se a tela não parecer com o que o agente descreveu, use o **link direto** (logado na Vercel):

**➡️ Abrir variáveis do projeto:**  
https://vercel.com/levyoliveirabrs-projects/crm-fled/settings/environment-variables

(Se pedir login, entre com a mesma conta do GitHub/`LevyOliveirabr`.)

Atalho do projeto: https://vercel.com/levyoliveirabrs-projects/crm-fled

---

## Caminho pelos cliques (desktop)

1. Abra https://vercel.com/dashboard  
2. No **canto superior esquerdo**, confira o time: deve estar **`levyoliveirabrs-projects`**.  
3. Clique no projeto **`crm-fled`**.  
4. No menu **da esquerda** (dentro do projeto), clique em **Settings** (Configurações).  
5. Ainda na coluna da esquerda, clique em **Environment Variables**  
   - Em português pode aparecer como **Variáveis de Ambiente**.  
6. Você verá um formulário **Key / Value** (ou botão **Add More** / **Import .env**).

> Não é em Team Settings. É em **Project → Settings → Environment Variables**.

---

## Forma mais fácil: Import .env

Na mesma página, procure **Import .env** (ou “Importar”) e cole isto (troque pelos valores do **Supabase → Project Settings → API**):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_a_anon_public_aqui
SUPABASE_SERVICE_ROLE_KEY=cole_a_service_role_aqui
SUPABASE_JWT_SECRET=cole_o_jwt_secret_aqui
APP_URL=https://crm-fled.vercel.app
```

Onde achar no Supabase (https://supabase.com/dashboard):

| Variável Vercel | No Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → **anon** `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → **service_role** (Reveal) |
| `SUPABASE_JWT_SECRET` | Settings → API → **JWT Secret** |
| `APP_URL` | fixo: `https://crm-fled.vercel.app` |

Marque os ambientes **Production** e **Preview** → **Save**.

---

## Depois de salvar (obrigatório)

As variáveis **não valem** no deploy antigo. Faça:

1. Aba **Deployments** do `crm-fled`  
2. No deployment mais recente → menu **⋯** → **Redeploy**  
3. Aguarde 1–2 min e teste: https://crm-fled.vercel.app/login  

Esperado: página de login (não “Internal Server Error”).

---

## Se ainda não achar a opção

Mande o print ou diga:

1. Qual URL está na barra do navegador?  
2. Qual time aparece no canto superior esquerdo?  
3. O projeto se chama **`crm-fled`** ou outro (`crm`, `temporary-…`)?  
