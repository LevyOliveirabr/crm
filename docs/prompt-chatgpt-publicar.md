# Prompt pronto para o ChatGPT — publicar o CRM F-Led

Copie o bloco abaixo inteiro e cole no ChatGPT (idealmente com GPT que tenha navegador / Computer Use / capacidade de guiar cliques, ou peça passo a passo).

---

## PROMPT (copie a partir daqui)

```
Você é meu assistente técnico. Sua ÚNICA missão agora é PUBLICAR em produção o CRM Comercial F-Led e deixar a URL oficial funcionando (login HTTP 200, sem Internal Server Error).

Eu continuo o desenvolvimento no Cursor. Você cuida só da publicação / operação no Vercel + Supabase Auth URLs.

========================
CONTEXTO DO PROJETO
========================

- Nome: CRM Comercial F-Led (Next.js App Router + Supabase + Vercel)
- Repositório GitHub: https://github.com/LevyOliveirabr/crm
- Branch de produção: main
- Código já está na main e o build já foi corrigido (npm run build passa)
- Projeto Vercel (já existe): crm-fled
- Time Vercel: levyoliveirabrs-projects
- URL oficial pretendida: https://crm-fled.vercel.app
- Situação atual: https://crm-fled.vercel.app responde HTTP 500
- Causa do 500: faltam as 5 Environment Variables no dashboard do projeto crm-fled (o GitHub JÁ está conectado ao crm-fled; o deploy automático já funciona; o build já passa)
- Supabase (já criado): projeto ref owgbgrksfwdiftdfapdm
  URL base: https://owgbgrksfwdiftdfapdm.supabase.co
- Login inicial esperado: usuário diretor no Supabase Auth (ex.: levyoliveirabr@gmail.com)

Docs no repo (leia se precisar):
- docs/status-vercel.md
- docs/onde-achar-env-vercel.md
- docs/publicar-producao.md
- docs/deploy-producao.md
- docs/checklist-producao.md
- docs/manual-utilizacao.md
- .env.local.example
- vercel.json (framework nextjs, region gru1)

========================
O QUE JÁ ESTÁ PRONTO (NÃO REFAÇA)
========================

1. Repo no GitHub com o app completo
2. Projeto Vercel crm-fled criado
3. GitHub conectado ao crm-fled (push na main já dispara deploy)
4. Build corrigido e mergeado
5. Banco/Auth no Supabase já existem

========================
O QUE FALTA (FAÇA ISSO)
========================

### A) Cadastrar Environment Variables no Vercel

Link direto (preferir este):
https://vercel.com/levyoliveirabrs-projects/crm-fled/settings/environment-variables

Se o link não abrir:
1. https://vercel.com/dashboard
2. Time no canto superior esquerdo: levyoliveirabrs-projects
3. Abrir projeto crm-fled (NÃO abrir projetos temporary-*)
4. Settings → Environment Variables (ou “Variáveis de Ambiente”)
5. Usar “Import .env” se existir

Cadastrar estas 5 variáveis em Production E Preview:

NEXT_PUBLIC_SUPABASE_URL=<Project URL do Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public>
SUPABASE_SERVICE_ROLE_KEY=<service_role — secreto>
SUPABASE_JWT_SECRET=<JWT Secret>
APP_URL=https://crm-fled.vercel.app

Onde pegar no Supabase (https://supabase.com/dashboard → projeto owgbgrksfwdiftdfapdm):
- Settings → API → Project URL
- Settings → API → anon public
- Settings → API → service_role (Reveal)
- Settings → API → JWT Secret

IMPORTANTE:
- NÃO invente valores. Peça para eu colar os secrets se você não tiver acesso, OU leia do dashboard se eu te der acesso/sessão.
- NÃO commitar secrets no GitHub.
- Depois de salvar as vars, fazer Redeploy obrigatório (vars não valem em deploy antigo).

### B) Redeploy

1. Vercel → crm-fled → Deployments
2. No deployment mais recente da main → ⋯ → Redeploy
3. Preferir sem “Use existing Build Cache” se houver dúvida
4. Esperar status Ready / Success

### C) Configurar Supabase Auth URLs

Supabase → Authentication → URL Configuration:

- Site URL: https://crm-fled.vercel.app
- Redirect URLs (adicionar, sem remover localhost se eu ainda usar local):
  - https://crm-fled.vercel.app/auth/callback
  - https://crm-fled.vercel.app/auth/definir-senha
  - http://localhost:3000/auth/callback
  - http://localhost:3000/auth/definir-senha

### D) Limpeza (se ainda houver X vermelho no GitHub)

Desconectar ou apagar projetos Vercel temporary-* ligados ao repo LevyOliveirabr/crm.
Só o projeto crm-fled deve ficar conectado à main.

### E) Validação obrigatória

1. curl / browser: https://crm-fled.vercel.app/login → HTTP 200 (página de login F-Led, NÃO “Internal Server Error”)
2. Login com o usuário diretor
3. Cair em /hoje
4. Smoke rápido: Hoje, Funil, Empresas, Nova negociação, Relatórios (diretor), Configurações (diretor)
5. Checklist completo: docs/checklist-producao.md (12 testes)

========================
REGRAS DE EXECUÇÃO
========================

- Me guie passo a passo em português, com cliques exatos e links diretos.
- Se eu disser que “não acho Environment Variables”, use SEMPRE o link direto acima e peça print da tela (URL da barra + time no canto + nome do projeto).
- Se você tiver Computer Use / navegador, faça você mesmo no dashboard (com minha sessão/aprovação).
- Não altere código do app para “resolver” env vars.
- Não crie outro projeto Vercel novo se crm-fled já existir — use crm-fled.
- Não mude a URL oficial sem necessidade (ficar em https://crm-fled.vercel.app).
- Ao terminar, me devolva:
  1) URL pública final
  2) Confirmação das 5 env vars (só os NOMES, sem revelar secrets)
  3) Confirmação Site URL / Redirects no Supabase
  4) Resultado do teste de login
  5) Qualquer pendência restante

Comece agora: primeiro confirme se consigo abrir o link das Environment Variables do crm-fled. Se não, me diga exatamente o que clicar e o que me pedir (print/URL).
```

## FIM DO PROMPT

---

## Onde o projeto está publicado hoje

| Item | Valor |
|---|---|
| Código | https://github.com/LevyOliveirabr/crm (`main`) |
| App oficial (ainda quebrado sem env) | https://crm-fled.vercel.app |
| Projeto Vercel | `crm-fled` no time `levyoliveirabrs-projects` |
| Painel do projeto | https://vercel.com/levyoliveirabrs-projects/crm-fled |
| Vars (link direto) | https://vercel.com/levyoliveirabrs-projects/crm-fled/settings/environment-variables |
| Banco/Auth | Supabase `owgbgrksfwdiftdfapdm` |

**Resumo:** o código já está na nuvem e o Vercel já faz deploy pela `main`. O que falta para “estar no ar de verdade” é só configurar as 5 variáveis + Redeploy + Auth URLs no Supabase.
