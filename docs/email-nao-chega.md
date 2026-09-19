# E-mail de “esqueci senha” não chega

## Causa mais comum

O Supabase **sem SMTP próprio** usa o provedor embutido, só para teste:

- **~2 e-mails por hora** no projeto inteiro
- Pode ir para **spam**
- Remetente costuma ser algo como `noreply@mail.app.supabase.io`

Se você pediu várias vezes (localhost + produção), o limite provavelmente estourou.

## O que fazer agora (rápido, sem e-mail)

1. Abra https://supabase.com/dashboard/project/owgbgrksfwdiftdfapdm/auth/users  
2. Achile o usuário pelo e-mail  
3. Menu **⋯** → **Send password recovery** **ou** defina senha manualmente se a opção existir  
4. Se enviar recovery pelo painel, use o link do e-mail (deve ser `crm-fled.vercel.app`)

Alternativa: no usuário, use **Reset password** / editar e gravar uma senha temporária; depois entre em https://crm-fled.vercel.app/login

## Conferir se o Supabase tentou enviar

1. https://supabase.com/dashboard/project/owgbgrksfwdiftdfapdm/logs/edge-logs  
   ou **Authentication → Logs**  
2. Procure eventos `recover` / `reset` / erros `rate limit` / `gomail`

## Checklist

- [ ] Spam / Promotions / Lixo eletrônico  
- [ ] Esperar **60 minutos** sem novos pedidos  
- [ ] Site URL = `https://crm-fled.vercel.app` (já ajustado)  
- [ ] Pedir **um** novo e-mail só depois da espera  

## Solução imediata sem e-mail (rate limit)

Com a chave `SUPABASE_SERVICE_ROLE_KEY` (Vercel → Environment Variables):

```bash
git clone https://github.com/LevyOliveirabr/crm.git
cd crm

NEXT_PUBLIC_SUPABASE_URL=https://owgbgrksfwdiftdfapdm.supabase.co \
SUPABASE_SERVICE_ROLE_KEY='cole_a_service_role_aqui' \
EMAIL='seu@email.com' \
NOVA_SENHA='SuaSenhaForte123!' \
node scripts/set-password.mjs
```

Depois entre em https://crm-fled.vercel.app/login

## Solução definitiva (recomendado)

Authentication → SMTP Settings → configurar provedor próprio (Resend, SendGrid, Amazon SES, etc.).  
Isso remove o limite de 2 e-mails/hora do provedor embutido.
