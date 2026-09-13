# Checklist de fumaça — produção (entrega 1)

Execute um a um na URL de produção (desktop e celular ~390px). Marque só depois de confirmar o resultado esperado.

Variáveis de ambiente usadas no deploy (as mesmas de `.env.local`, com `APP_URL` = URL de produção):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `APP_URL`

**URL de produção:** https://crm-fled.vercel.app

Pré-requisitos antes dos testes:

1. Projeto `crm-fled` na Vercel no ar (`vercel.json` com região `gru1`).
2. Variáveis acima configuradas em Production (e Preview se quiser) **no dashboard** — não só no workaround do build.
3. Supabase → Authentication → URL Configuration:
   - **Site URL** = `https://crm-fled.vercel.app`
   - **Redirect URLs** inclui `https://crm-fled.vercel.app/auth/callback` e `https://crm-fled.vercel.app/auth/definir-senha`
4. Diretor e Levy com usuário ativo (convite / senha definida).

---

## Os 12 testes

| # | Teste | Como validar | Desktop | Mobile | OK |
|---|---|---|---|---|---|
| 1 | Login diretor | Entrar com e-mail/senha do perfil diretor; cai em `/hoje` com menu completo (inclui Configurações / Relatórios). | [ ] | [ ] | [ ] |
| 2 | Login vendedor | Entrar com perfil vendedor; vê só a própria carteira; sem Configurações de admin. | [ ] | [ ] | [ ] |
| 3 | Criar empresa | `/empresas` → nova empresa com campos mínimos; aparece na lista e abre a ficha. | [ ] | [ ] | [ ] |
| 4 | Criar negociação | `/negociacoes/nova` (ou fluxo equivalente); empresa + etapa inicial; aparece no funil e na ficha. | [ ] | [ ] | [ ] |
| 5 | Registrar interação | Na ficha da negociação, registrar contato/interação; entra no histórico. | [ ] | [ ] | [ ] |
| 6 | Mover etapa | No funil (drag no desktop / "Mover para" no mobile) ou na ficha; etapa atualiza e histórico registra. | [ ] | [ ] | [ ] |
| 7 | Concluir ação com próxima | Concluir ação pendente; se ficar sem próxima, abrir mini-form "Próxima ação?" (pode pular); nova ação aparece em `/hoje`. | [ ] | [ ] | [ ] |
| 8 | Anexar orçamento | Na ficha, anexar/vincular orçamento; fica listado na negociação. | [ ] | [ ] | [ ] |
| 9 | Marcar venda | Marcar como venda com **valor final** obrigatório; some do funil aberto e entra no resultado. | [ ] | [ ] | [ ] |
| 10 | Marcar perda | Marcar como perda com **motivo** obrigatório; some do funil aberto. | [ ] | [ ] | [ ] |
| 11 | Relatório presidência | `/relatorios` aba Presidência: números batem com a base; imprimir / copiar texto funcionam. | [ ] | [ ] | [ ] |
| 12 | Importar CSV | `/configuracoes` → importação (diretor); CSV processa; contagens de empresas/negociações batem; relatório de erros legível se houver. | [ ] | [ ] | [ ] |

---

## Pós-importação da base real

- [ ] Contagem de empresas no app = linhas válidas do CSV.
- [ ] Contagem de negociações no app = linhas válidas do CSV.
- [ ] Diretor recebeu convite e criou a senha.
- [ ] Levy consegue login em produção.
- [ ] Relatório da presidência mostra os números da base real (conferir com SQL/`relatorio_presidencia`).

## Se falhar

| Sintoma | Causa provável |
|---|---|
| Build ok local, falha na Vercel | Variável de ambiente faltando (as 5 acima). |
| Login ok local, falha em produção | Site URL / Redirect URLs no Supabase. |
| Erro 500 em Server Action | Vercel → Logs; quase sempre RLS / client errado. |
| Vendedor vê carteira alheia | RLS ou consulta sem filtro de `vendedor_id`. |

## Registro da execução

- URL de produção: _______________________________
- Data/hora: _______________________________
- Quem testou: _______________________________
- Observações: _______________________________
