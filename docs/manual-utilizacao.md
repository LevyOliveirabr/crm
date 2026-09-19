# Manual de utilização — CRM Comercial F-Led

Sistema de CRM para a equipe comercial da F-Led: acompanhar empresas, negocições, ações do dia e o relatório da presidência com o mínimo de digitação.

**URL de produção pretendida:** https://crm-fled.vercel.app  
**Se a produção estiver em 500:** use o link temporário atual (ver `docs/status-vercel.md`) até configurar as env vars no projeto `crm-fled`.

---

## 1. Acesso e perfis

### Login

1. Abra `/login`.
2. Entre com e-mail e senha do Supabase Auth.
3. Você cai em **`/hoje`**.

Primeiro acesso por convite: o diretor convida em **Configurações → Usuários**; o convidado define a senha em `/auth/definir-senha`.

### Perfis

| Perfil | O que vê / faz |
|---|---|
| **Diretor** | Tudo: carteira de todos, Configurações, importação CSV, relatório da presidência completo |
| **Vendedor** | Só a própria carteira de negociações/ações; vê empresas e contatos de todos; **sem** telas de admin |

---

## 2. Telas principais

### Dashboard (`/dashboard`) — tela inicial

Visão consolidada da carteira (negociações abertas), no padrão do PPT "Dashboard - CRM".

- **Filtros** (ficam na URL, dá para compartilhar o link): período, responsável (diretor), fase/estágio, visão data (previsão de fechamento, criação ou fechamento real), região (UF da empresa), fonte (origem) e segmento (público / privado / PPP).
- **Pipeline de vendas**: barras por trimestre do ano atual e do próximo; o trimestre atual fica em amarelo.
- **Por estágio**: valor e quantidade por etapa de cada funil ativo.
- **KPIs**: pipeline total, pipeline ponderado (pesos de temperatura), win rate do período, forecast do mês, do mês seguinte e do trimestre.
- **Próximos fechamentos**: negociações quentes com previsão nos próximos 30 dias.
- **Oportunidades em risco**: sem próxima ação, ação atrasada ou sem interação há mais de `dias_risco_dashboard` dias (padrão 15; chave opcional em `config`).
- **Base de dados**: tabela das abertas com conta, responsável, fase, segmento, valor, previsão e data de faturamento.
- **Memorial de cálculo**: botão no topo explica a fórmula de cada número.
- **Nova oportunidade**: abre o mesmo formulário de nova negociação.

Campos novos que alimentam o dashboard: **Tipo de cliente** na ficha da empresa (público / privado / PPP) e **Faturamento** (data) na ficha da negociação.

### Meu dia (`/hoje`)

Centro do dia a dia.

- Lista ações **atrasadas** e **de hoje**.
- Concluir uma ação: se a negocição ficar sem próxima ação, o sistema pede a **próxima** (pode pular).
- Atalhos para abrir a ficha da negocição.

**Rotina sugerida:** comece sempre por aqui; zere atrasadas antes de prospectar.

### Funil (`/funil`)

- Visão **Kanban** (desktop: arrastar cartões) ou **lista**.
- No celular: use **Mover para** em vez de drag.
- Filtros por funil / vendedor (diretor).

### Empresas (`/empresas` e `/empresas/[id]`)

- Busca e cadastro rápido (nome + cidade bastam).
- Ficha: contatos, negocições ligadas, anotações.

### Contatos (`/contatos`)

Lista global com busca; vínculo com empresa.

### Negociação (`/negociacoes/nova` e `/negociacoes/[id]`)

Cadeia: **Empresa → Contato → Negociação → Etapa → Próxima ação → Venda ou Perda**.

Na ficha você:

- Registra **interações** (ligação, WhatsApp, visita, etc.).
- Cria / conclui **ações**.
- Move de **etapa**.
- Anexa **orçamento** (quando disponível).
- Fecha como **vendida** (valor final obrigatório) ou **perdida** (motivo obrigatório).

Botão flutuante **+** (quando visível) abre nova negocição.

### Relatórios (`/relatorios`)

- Aba **Presidência**: vendido no mês vs anterior, previsão, maiores abertas, perdas. Imprimir / copiar texto.
- Aba **Funil** e demais análises (conforme liberado).
- Exportação Excel/CSV quando o botão de exportar aparecer.

### Configurações (`/configuracoes`) — só diretor

| Subpágina | Uso |
|---|---|
| Funis | Funis e etapas parametrizáveis |
| Listas | Segmentos, origens, motivos de perda, etc. |
| Parâmetros | Ajustes gerais |
| Produtos | Catálogo para orçamento |
| Emitente | Dados da empresa nos documentos |
| Usuários | Convidar, ativar/desativar, perfil |
| Importar | CSV de empresas / contatos / negocições / produtos |
| API keys | Chaves para agentes MCP (Cursor, Claude, **Grok**) |

Modelos de CSV: pasta `modelos/` no repositório (`modelos/LEIA-ME.txt`).

---

## 3. Fluxo do dia (vendedor)

1. **Login** → `/hoje`.
2. Tratar ações atrasadas e de hoje (ligar / WhatsApp / visita).
3. Em cada contato, registrar a **interação** na ficha.
4. Sempre deixar uma **próxima ação** com data.
5. Mover etapa no funil quando o status mudar.
6. Fechar venda ou perda assim que souber o resultado (não deixar “parada” sem motivo).

## 4. Fluxo do diretor

Além do fluxo do vendedor:

1. Revisar **Relatório da Presidência** no início da semana / mês.
2. Ajustar funis e listas quando o processo mudar.
3. Convidar novos vendedores.
4. Importar base CSV quando houver carga inicial ou atualização em lote.
5. Gerar **API keys** para cada agente (Grok, Cursor, etc.) e revogar as antigas.

---

## 5. Integração MCP (agentes de IA)

O CRM expõe um servidor **MCP** (Model Context Protocol) em:

```text
https://<seu-dominio>/api/mcp/mcp
```

Produção (quando estável): `https://crm-fled.vercel.app/api/mcp/mcp`

Autenticação: header `Authorization: Bearer <api_key>`.

### 5.1 Gerar a API key

1. Login no CRM (como o usuário que o agente deve “representar” — vendedor ou diretor).
2. Vá em **API keys** (`/configuracoes/api-keys`).
3. Nomeie a key (ex.: `Grok bot`, `Cursor Levy`).
4. **Copie a key na hora** — ela só aparece uma vez.
5. Guarde em gerenciador de senhas / variável de ambiente. Nunca commit no Git.

A key herda o **mesmo RLS** do dono: o agente só vê/edita o que aquele usuário pode. Toda escrita grava interação com `origem_agente = true` e texto prefixado com `[agente]`.

Revogar: botão Revogar na mesma tela → próximas chamadas retornam **401**.

### 5.2 Tools disponíveis

| Tool | Para que serve |
|---|---|
| `buscar_empresa` | Achar empresa por texto |
| `criar_empresa` | Criar empresa (+ contato opcional) |
| `listar_negociacoes` | Filtrar abertas, paradas, por etapa… |
| `obter_negociacao` | Ficha + timeline |
| `criar_negociacao` | Abrir negocição |
| `registrar_interacao` | Ligação / WhatsApp / visita… |
| `criar_acao` / `concluir_acao` | Próximas ações |
| `mover_etapa` | Avançar no funil |
| `fechar_negociacao` | Venda ou perda |
| `relatorio_presidencia` | Números do mês |
| `previsao` | Previsão de fechamento |
| `buscar_produto` | Catálogo |
| `montar_orcamento` | Montar rascunho de orçamento |

Resources: `crm://funis`, `crm://listas`, `crm://negociacao/{id}`.

Rate limit: **60 chamadas/min** por key. Logs em `mcp_log`.

---

## 6. Conectar o Grok (agenda / bot)

Use o MCP remoto do CRM no Grok CLI, no Grok Build ou na API xAI. O agente passa a chamar as tools do CRM (listar negocições paradas, registrar ligações da agenda, etc.).

### 6.1 Pré-requisitos

1. CRM no ar com `SUPABASE_JWT_SECRET` configurado (senão o MCP quebra).
2. API key gerada (seção 5.1), de preferência no usuário do vendedor cuja agenda o bot cuida.
3. Variável de ambiente no seu Mac/PC (não cole a key no arquivo versionado):

```bash
export CRM_FLED_API_KEY="cole_a_key_aqui"
```

### 6.2 Grok CLI (recomendado)

```bash
grok mcp add --transport http crm-fled \
  https://crm-fled.vercel.app/api/mcp/mcp \
  --header "Authorization: Bearer ${CRM_FLED_API_KEY}"
```

Comandos úteis:

```bash
grok mcp list
grok mcp doctor crm-fled
```

No TUI do Grok: `/mcps` → ative o servidor `crm-fled`.

Equivalente em `~/.grok/config.toml`:

```toml
[mcp_servers.crm-fled]
url = "https://crm-fled.vercel.app/api/mcp/mcp"
headers = { Authorization = "Bearer ${CRM_FLED_API_KEY}" }
```

Se a produção ainda estiver em 500, troque a URL pela do deploy temporário que responder 200 (ver `docs/status-vercel.md`).

### 6.3 Escopo de projeto (opcional)

Na pasta do bot / agenda:

```bash
grok mcp add --scope project --transport http crm-fled \
  https://crm-fled.vercel.app/api/mcp/mcp \
  --header "Authorization: Bearer ${CRM_FLED_API_KEY}"
```

Isso grava `.grok/config.toml` local (pode versionar o arquivo **sem** a key — só `${CRM_FLED_API_KEY}`).

### 6.4 API xAI (bot programático / agenda)

No request, inclua o MCP remoto nas tools:

```json
{
  "model": "grok-4",
  "input": [
    {
      "role": "user",
      "content": "Liste minhas negocições paradas há mais de 7 dias e sugira o que ligar hoje."
    }
  ],
  "tools": [
    {
      "type": "mcp",
      "server_url": "https://crm-fled.vercel.app/api/mcp/mcp",
      "server_label": "crm-fled",
      "server_description": "CRM comercial F-Led: negocições, ações e empresas",
      "authorization": "<api_key>"
    }
  ]
}
```

Dica de agenda: combine o MCP do CRM com o calendário (Google Calendar MCP ou tool nativa). Fluxo típico do bot:

1. `listar_negociacoes` com `parada_ha_dias` ou ações do dia.
2. Cruzar com compromissos da agenda.
3. Depois da ligação: `registrar_interacao` + `criar_acao` / `concluir_acao`.

Exemplos de prompts para o Grok:

- “Quais negocições minhas estão paradas há mais de 5 dias?”
- “Registre que liguei para a Remo e remarquei follow-up para sexta.”
- “Monte o resumo da presidência deste mês.”
- “Crie uma negocição para Empresa X, R$ 80.000, funil Prospecção.”

### 6.5 Cursor e Claude Desktop

Detalhes em `docs/mcp.md`. Resumo Cursor (`mcp.json`):

```json
{
  "mcpServers": {
    "crm-fled": {
      "url": "https://crm-fled.vercel.app/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer <api_key>"
      }
    }
  }
}
```

Grok também consegue **ler** `~/.cursor/mcp.json` se a compatibilidade Cursor estiver ligada (`grok inspect` mostra a origem).

---

## 7. Problemas frequentes

| Sintoma | O que fazer |
|---|---|
| Site 500 em `crm-fled.vercel.app` | Configurar as 5 env vars + Redeploy (`docs/status-vercel.md`) |
| Login ok local, falha em produção | Site URL / Redirect no Supabase |
| MCP 401 | Key errada ou revogada; gere outra |
| MCP 500 | Falta `SUPABASE_JWT_SECRET` no Vercel |
| Vendedor vê carteira alheia | Não deveria — abrir chamado; checar RLS |
| X vermelho “Deployment failed” no GitHub | Projeto `temporary-*` ainda ligado ao repo — desconectar |

---

## 8. Onde está cada documento

| Arquivo | Conteúdo |
|---|---|
| `docs/manual-utilizacao.md` | Este manual (uso + MCP/Grok) |
| `docs/mcp.md` | Config técnica MCP (Cursor/Claude) |
| `docs/status-vercel.md` | Diagnóstico do “conflito” Vercel |
| `docs/deploy-producao.md` | Deploy operacional |
| `docs/publicar-producao.md` | Claim / import GitHub→Vercel |
| `docs/checklist-producao.md` | 12 testes de fumaça |
| `SPEC.md` | Especificação completa do sistema |
