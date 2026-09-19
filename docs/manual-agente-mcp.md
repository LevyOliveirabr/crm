# Manual: criar um agente que conversa com o CRM (MCP)

Este guia mostra como ligar um agente de IA ao CRM F-Led usando o servidor
**MCP** (Model Context Protocol) que já vem no sistema. Com ele você pergunta
em linguagem natural ("quais negociações estão paradas?", "registra que liguei
para a Brasiluz") e o agente lê e grava direto no CRM, respeitando as
permissões do usuário dono da chave.

Funciona com Claude (Desktop, Claude Code, API), Cursor, Grok, ChatGPT e
qualquer cliente que fale MCP por HTTP.

---

## 1. Como funciona em uma frase

O CRM expõe um endpoint MCP. Você gera uma **API key** para um usuário. Um
cliente de IA se conecta nesse endpoint com a key e passa a enxergar as
"tools" (ações) e "resources" (dados de referência) do CRM. Tudo que o agente
faz fica na timeline da negociação com o prefixo `[agente]` e no log
`mcp_log`.

| Item | Valor |
|---|---|
| Endpoint (produção) | `https://crm-fled.vercel.app/api/mcp/mcp` |
| Endpoint (local) | `http://localhost:3000/api/mcp/mcp` |
| Transporte | Streamable HTTP (MCP) |
| Autenticação | header `Authorization: Bearer <api_key>` |
| Permissões | as mesmas do usuário dono da key (RLS do Supabase) |
| Limite | 60 chamadas por minuto por key |

---

## 2. Passo a passo em 5 minutos

### 2.1 Gerar a API key

1. Entre no CRM com o usuário que o agente vai representar. Para um agente
   pessoal, use o seu próprio login. Para um agente da diretoria, use o login
   de diretor.
2. Menu **API keys** (`/configuracoes/api-keys`).
3. Dê um nome (ex.: `Claude Desktop Levy`) e clique em gerar.
4. **Copie a key na hora.** Ela só aparece uma vez.
5. Guarde num gerenciador de senhas ou variável de ambiente. Nunca no Git.

Para revogar, use o botão Revogar na mesma tela. As próximas chamadas
recebem `401`.

### 2.2 Testar que o endpoint responde

Com a key em mãos, no terminal:

```bash
export CRM_FLED_API_KEY="cole-a-key-aqui"

curl -s https://crm-fled.vercel.app/api/mcp/mcp \
  -H "Authorization: Bearer $CRM_FLED_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Deve voltar a lista de tools (`buscar_empresa`, `listar_negociacoes`, …).
Se voltar `401`, a key está errada ou revogada.

### 2.3 Conectar o cliente de IA

Escolha o seu na seção 3.

### 2.4 Primeira conversa

Peça ao agente:

> Liste minhas negociações abertas sem próxima ação.

Ele deve chamar `listar_negociacoes` e responder com a lista. Depois:

> Registra que liguei hoje para a primeira da lista e agenda uma visita para sexta.

Ele deve chamar `registrar_interacao` e `criar_acao`. Confira na ficha da
negociação: a timeline mostra as duas entradas com `[agente]`.

---

## 3. Configurar cada cliente

### 3.1 Claude Code (terminal)

```bash
claude mcp add --transport http crm-fled \
  https://crm-fled.vercel.app/api/mcp/mcp \
  --header "Authorization: Bearer $CRM_FLED_API_KEY"
```

Depois, dentro do Claude Code: `/mcp` mostra o servidor conectado.

### 3.2 Claude Desktop

O Claude Desktop conecta a servidores remotos com header por meio da ponte
`mcp-remote`. Edite `claude_desktop_config.json` (Configurações ›
Desenvolvedor › Editar configuração):

```json
{
  "mcpServers": {
    "crm-fled": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://crm-fled.vercel.app/api/mcp/mcp",
        "--header",
        "Authorization: Bearer ${CRM_FLED_API_KEY}"
      ],
      "env": {
        "CRM_FLED_API_KEY": "cole-a-key-aqui"
      }
    }
  }
}
```

Reinicie o Claude Desktop. O ícone de ferramentas mostra `crm-fled`.

### 3.3 Cursor

Arquivo `.cursor/mcp.json` no projeto (ou o global, em Cursor Settings › MCP):

```json
{
  "mcpServers": {
    "crm-fled": {
      "url": "https://crm-fled.vercel.app/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer cole-a-key-aqui"
      }
    }
  }
}
```

### 3.4 Grok (CLI)

```bash
grok mcp add --transport http crm-fled \
  https://crm-fled.vercel.app/api/mcp/mcp \
  --header "Authorization: Bearer ${CRM_FLED_API_KEY}"

grok mcp doctor crm-fled
```

### 3.5 ChatGPT e outros

Clientes que aceitam "custom connector" por URL funcionam com o mesmo
endpoint. Quando o cliente não permite informar header de autorização (caso
de alguns conectores só com OAuth), use a ponte `mcp-remote` como no Claude
Desktop, ou o agente próprio da seção 4.

---

## 4. Criar o seu próprio agente (API da Anthropic)

Para um agente que roda sozinho (bot no WhatsApp, rotina agendada, painel
interno), use a API da Anthropic com o **MCP connector**: a Anthropic conecta
no servidor MCP do CRM por você, sem loop de ferramentas no seu código.

### 4.1 Instalar

```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY="sua-chave-anthropic"
export CRM_FLED_API_KEY="key-gerada-no-crm"
```

### 4.2 Agente mínimo (TypeScript)

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const client = new Anthropic();

// Prompt de sistema da seção 5 (salve em prompt-agente-crm.md)
const SYSTEM = readFileSync("./prompt-agente-crm.md", "utf8");

export async function perguntarAoCrm(pergunta: string): Promise<string> {
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["mcp-client-2025-11-20"],
    system: SYSTEM,
    mcp_servers: [
      {
        type: "url",
        url: "https://crm-fled.vercel.app/api/mcp/mcp",
        name: "crm-fled",
        authorization_token: process.env.CRM_FLED_API_KEY!,
      },
    ],
    tools: [{ type: "mcp_toolset", mcp_server_name: "crm-fled" }],
    messages: [{ role: "user", content: pergunta }],
  });

  if (response.stop_reason === "refusal") {
    return "Não consegui atender esse pedido.";
  }

  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Exemplo
console.log(await perguntarAoCrm("Resuma minhas negociações paradas há mais de 15 dias."));
```

O connector executa as tools do CRM no lado da Anthropic e devolve só a
resposta final. Para conversa com histórico, acumule `messages` (pergunta do
usuário, `response.content` do assistente, próxima pergunta) e envie tudo a
cada chamada.

### 4.3 Bot de rotina (exemplo: resumo às 7h)

Combine com o cron da Vercel ou qualquer agendador:

```typescript
const resumo = await perguntarAoCrm(
  "Gere um resumo de 5 linhas para o diretor: vendido no mês, " +
    "maiores negociações abertas, ações atrasadas por vendedor e riscos.",
);
// envie `resumo` por e-mail, WhatsApp ou Slack
```

Para o resumo do diretor, gere a key com o login de diretor; ele enxerga a
equipe toda.

### 4.4 Alternativa sem o connector

Se preferir controlar o loop, use o SDK do MCP no Node
(`@modelcontextprotocol/sdk`, transporte `StreamableHTTPClientTransport` com
o header Bearer) para listar e chamar as tools, e o `toolRunner` do SDK da
Anthropic para orquestrar. O connector da seção 4.2 é o caminho mais curto.

---

## 5. Prompt de sistema recomendado para o agente

Salve como `prompt-agente-crm.md` e use no campo `system` (ou como
"instruções do projeto" no cliente de IA). Ajuste os nomes.

```markdown
Você é o assistente comercial da F-Led e opera o CRM por meio das tools do
servidor MCP "crm-fled". Fala português do Brasil, direto e objetivo.

## Regras
1. Antes de criar qualquer coisa, procure se já existe: use buscar_empresa
   e listar_negociacoes. Nunca crie empresa ou negociação duplicada.
2. Só grave (criar, registrar, mover, fechar) quando o usuário pedir
   claramente. Em dúvida, pergunte em uma linha.
3. Fechar como vendida ou perdida é irreversível: confirme valor final
   (venda) ou motivo (perda) antes de chamar fechar_negociacao.
4. Toda interação registrada deve ter um texto curto e útil: com quem falou,
   o que foi combinado, próximo passo.
5. Depois de registrar uma interação, garanta que a negociação tem próxima
   ação com data. Se não tiver, crie uma (criar_acao).
6. Datas sempre no formato AAAA-MM-DD. "Sexta" significa a próxima
   sexta-feira a partir de hoje. Se a data for ambígua, pergunte.
7. Valores em reais. Quando o usuário disser "150 mil", envie 150000.
8. Ao listar, resuma: empresa, valor, etapa, dias parada e próxima ação.
   Máximo de 10 itens; ofereça ver mais.
9. Nunca invente ids. Use os ids retornados pelas tools.
10. Se uma tool devolver erro, explique em uma frase e sugira o que fazer.

## Fluxos comuns
- "Liguei para X": buscar_empresa(X) → listar_negociacoes da empresa →
  registrar_interacao(tipo ligacao) → criar_acao se faltar próxima ação.
- "Nova oportunidade na X de 200 mil": buscar_empresa → criar_negociacao
  (valor_estimado 200000, proxima_acao obrigatória).
- "Como está o mês": relatorio_presidencia e previsao, depois um resumo de
  até 8 linhas com números em R$.
- "O que está parado": listar_negociacoes(status aberta, parada_ha_dias 15).
```

---

## 6. Referência das tools

Todos os argumentos de data usam `AAAA-MM-DD`. Ids são UUID.

| Tool | Para que serve | Argumentos |
|---|---|---|
| `buscar_empresa` | Achar empresas por parte do nome (até 10, com nº de negociações abertas) | `texto` |
| `criar_empresa` | Criar empresa (reutiliza se o nome já existir) e contato opcional | `nome`, `cidade?`, `uf?`, `segmento?`, `contato?{nome, whatsapp?, cargo?}` |
| `listar_negociacoes` | Listar negociações com filtros | `status?` (aberta/vendida/perdida), `funil?`, `etapa?`, `responsavel_email?`, `parada_ha_dias?`, `limite?` (padrão 30, máx. 100) |
| `obter_negociacao` | Ficha completa: timeline, ações, orçamentos | `id` |
| `criar_negociacao` | Abrir negociação na primeira etapa do funil | `empresa_id` ou `empresa_nome`, `valor_estimado`, `funil?`, `linha?`, `origem?`, `temperatura?` (1 fria, 2 morna, 3 quente), `previsao_mes?`, `proxima_acao?{descricao, data, tipo?}` |
| `registrar_interacao` | Gravar ligação, WhatsApp, visita, reunião, e-mail ou anotação | `negociacao_id`, `tipo` (ligacao/whatsapp/visita/reuniao/email/anotacao), `texto?` |
| `criar_acao` | Agendar próxima ação | `negociacao_id`, `descricao`, `data`, `tipo?` (ligar/whatsapp/visita/reuniao/proposta/outro), `hora?` |
| `concluir_acao` | Concluir ação e, opcionalmente, agendar a próxima | `acao_id`, `proxima?{descricao, data}` |
| `mover_etapa` | Mover para outra etapa do mesmo funil | `negociacao_id`, `etapa` (nome ou id) |
| `fechar_negociacao` | Marcar vendida ou perdida | `negociacao_id`, `resultado` (vendida/perdida), `valor_final?` (obrigatório na venda), `motivo?` (obrigatório na perda), `anotacao?` |
| `relatorio_presidencia` | Números do mês: vendido, variação, previsão, top 10, perdas | `mes?` (`AAAA-MM`) |
| `previsao` | Previsão de fechamento por mês (aberto, realista, otimista) | `meses?` (padrão 3) |
| `buscar_produto` | Catálogo de produtos ativos | `texto` |
| `montar_orcamento` | Reservado (retorna aviso) | — |

### Resources (dados de referência, só leitura)

| Resource | Conteúdo |
|---|---|
| `crm://funis` | Funis e etapas ativas (nomes que `mover_etapa` aceita) |
| `crm://listas` | Linhas, origens, segmentos e motivos de perda |
| `crm://negociacao/{id}` | Ficha completa de uma negociação |

Peça ao agente "leia o resource crm://funis" quando ele errar nome de etapa.

---

## 7. Segurança, limites e auditoria

- **Permissão por usuário.** A key herda o RLS do dono: vendedor só vê e
  edita as próprias negociações; gerente, a equipe; diretor, tudo. Empresas e
  contatos são visíveis a todos.
- **Rastreabilidade.** Toda escrita via agente grava interação com
  `origem_agente = true` e texto iniciado por `[agente]`. Cada chamada fica
  em `mcp_log` (tool, argumentos, ok, erro, tempo). Consulte no SQL Editor:
  `select * from mcp_log order by criado_em desc limit 50;`
- **Rate limit.** 60 chamadas por minuto por key. Acima disso a tool responde
  erro de limite; o agente deve esperar e repetir.
- **Uma key por agente.** Facilita revogar sem derrubar os outros.
- **Rotação.** Troque as keys a cada 90 dias ou quando alguém sair da equipe.
- **Variável no servidor.** O MCP precisa de `SUPABASE_JWT_SECRET` configurado
  na Vercel (já está em produção).

---

## 8. Exemplos de pedidos que funcionam bem

| Pedido | O que o agente faz |
|---|---|
| "Quais negociações estão paradas há mais de 20 dias?" | `listar_negociacoes` com `parada_ha_dias: 20` |
| "Registra que visitei a Itaipu hoje e eles pediram proposta até dia 30" | `buscar_empresa` → `registrar_interacao` (visita) → `criar_acao` (proposta, data) |
| "Abre uma negociação de 350 mil para a Construtora JB, linha Luminárias, quente" | `criar_negociacao` com `temperatura: 3` |
| "Move a negociação da Enel para Proposta" | `listar_negociacoes` → `mover_etapa` |
| "Fecha a da Zopone como vendida por 740 mil" | confirma → `fechar_negociacao` |
| "Como foi setembro comparado com agosto?" | `relatorio_presidencia` de cada mês e compara |
| "Quanto devo fechar nos próximos 3 meses?" | `previsao` |

---

## 9. Problemas frequentes

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `401 Unauthorized` | Key errada, revogada ou sem o prefixo `Bearer` | Gere uma key nova e confira o header |
| Cliente não lista as tools | URL sem `/api/mcp/mcp` ou cliente sem suporte a Streamable HTTP | Use a URL completa; no Claude Desktop use `mcp-remote` |
| Agente cria empresa duplicada | Prompt sem a regra de buscar antes | Use o prompt da seção 5 |
| "Etapa não encontrada" | Nome diferente do cadastrado | Peça para ler `crm://funis` |
| Vendedor não vê negociação que existe | RLS: ela é de outro responsável | Use key de diretor/gerente ou transfira o responsável |
| Erro de limite | Mais de 60 chamadas/min | Espere um minuto |

---

## 10. Onde está o código

- Servidor: `app/api/mcp/[transport]/route.ts`
- Tools e resources: `lib/mcp/tools.ts`
- Schemas dos argumentos: `lib/schemas/mcp.ts`
- Autenticação por key: `lib/mcp-auth.ts`
- Log e rate limit: `lib/mcp-log.ts`, `lib/mcp-rate-limit.ts`

Para adicionar uma tool nova: crie o schema em `lib/schemas/mcp.ts`, registre
em `lib/mcp/tools.ts` com `server.registerTool` dentro de `comLog`, e documente
na tabela da seção 6.
