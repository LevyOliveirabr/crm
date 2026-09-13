# MCP — configuração e teste (etapa 12)

Endpoint Streamable HTTP: `https://<dominio>/api/mcp/mcp`  
(local: `http://localhost:3000/api/mcp/mcp`)

Gere a key em **API keys** (`/configuracoes/api-keys`). Ela só aparece uma vez.

## Cursor (`mcp.json`)

```json
{
  "mcpServers": {
    "crm-fled": {
      "url": "https://<dominio>/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer <api_key>"
      }
    }
  }
}
```

## Claude Desktop (`claude_desktop_config.json`)

Clientes só-stdio usam `mcp-remote` como ponte:

```json
{
  "mcpServers": {
    "crm-fled": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<dominio>/api/mcp/mcp",
        "--header",
        "Authorization: Bearer <api_key>"
      ]
    }
  }
}
```

Se o Claude Desktop aceitar URL remota diretamente:

```json
{
  "mcpServers": {
    "crm-fled": {
      "url": "https://<dominio>/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer <api_key>"
      }
    }
  }
}
```

## Roteiro de teste

1. Em `/configuracoes/api-keys`, gere uma key para o vendedor de teste e copie.
2. Configure o Cursor com a URL `.../api/mcp/mcp` e o header Bearer.
3. No chat do Cursor (com MCP conectado), peça: **"liste minhas negociações paradas"**.
   - Esperado: tool `listar_negociacoes` (ex.: `parada_ha_dias` / status aberta) retornando só as do dono da key.
4. Peça: **"registre que liguei para a Remo"**.
   - Esperado: `buscar_empresa` / `listar_negociacoes` + `registrar_interacao` com texto prefixado `[agente]` e `origem_agente = true` na timeline.
5. Revogue a key e confirme que novas chamadas retornam **401**.
6. Em SQL / tabela `mcp_log`, confira tool, args, ok e ms de cada chamada.

Variável obrigatória no servidor: `SUPABASE_JWT_SECRET` (Settings → API → JWT Secret do projeto Supabase).
