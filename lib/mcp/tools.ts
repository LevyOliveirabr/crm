import type { McpServer } from "@modelcontextprotocol/server";
import { ResourceTemplate } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  formatarMoeda,
  inicioProximoMesISO,
  normalizarNome,
} from "@/lib/format";
import type { McpAuthContext } from "@/lib/mcp-auth";
import { clientForApiKey, McpAuthError } from "@/lib/mcp-auth";
import { registrarMcpLog } from "@/lib/mcp-log";
import { checarRateLimit } from "@/lib/mcp-rate-limit";
import {
  buscarEmpresaArgsSchema,
  buscarProdutoArgsSchema,
  concluirAcaoArgsSchema,
  criarAcaoArgsSchema,
  criarEmpresaArgsSchema,
  criarNegociacaoArgsSchema,
  fecharNegociacaoArgsSchema,
  listarNegociacoesArgsSchema,
  montarOrcamentoArgsSchema,
  moverEtapaArgsSchema,
  obterNegociacaoArgsSchema,
  previsaoArgsSchema,
  registrarInteracaoArgsSchema,
  relatorioPresidenciaArgsSchema,
} from "@/lib/schemas/mcp";

type ToolCtx = {
  http?: {
    req?: Request;
    authInfo?: unknown;
  };
};

function texto(content: string, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: content }],
    isError,
  };
}

function jsonText(data: unknown): CallToolResult {
  return texto(JSON.stringify(data, null, 2));
}

function prefixoAgente(textoBruto?: string | null): string {
  const base = (textoBruto ?? "").trim();
  if (!base) return "[agente]";
  if (base.startsWith("[agente]")) return base;
  return `[agente] ${base}`;
}

async function autenticarDoCtx(ctx: ToolCtx): Promise<McpAuthContext> {
  const req = ctx.http?.req;
  if (!req) {
    throw new McpAuthError("Contexto HTTP indisponível.", 500);
  }
  const auth = await clientForApiKey(req);
  const limit = checarRateLimit(auth.keyId);
  if (!limit.ok) {
    throw new McpAuthError("Rate limit: máximo 60 chamadas/min por key.", 429);
  }
  return auth;
}

async function comLog(
  tool: string,
  args: unknown,
  ctx: ToolCtx,
  fn: (auth: McpAuthContext) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const inicio = Date.now();
  let auth: McpAuthContext | null = null;
  try {
    auth = await autenticarDoCtx(ctx);
    const result = await fn(auth);
    await registrarMcpLog(auth, {
      tool,
      args,
      ok: !result.isError,
      erro: result.isError
        ? result.content
            .map((c) => ("text" in c ? c.text : ""))
            .join(" ")
            .slice(0, 500)
        : null,
      ms: Date.now() - inicio,
    });
    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro desconhecido no MCP.";
    if (auth) {
      await registrarMcpLog(auth, {
        tool,
        args,
        ok: false,
        erro: message,
        ms: Date.now() - inicio,
      });
    }
    return texto(message, true);
  }
}

async function obterFicha(
  auth: McpAuthContext,
  id: string,
): Promise<Record<string, unknown>> {
  const { data: negociacao, error } = await auth.supabase
    .from("v_negociacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!negociacao) throw new Error("Negociação não encontrada.");

  const [{ data: interacoes }, { data: acoes }, { data: orcamentos }] =
    await Promise.all([
      auth.supabase
        .from("interacoes")
        .select("*")
        .eq("negociacao_id", id)
        .order("criado_em", { ascending: false })
        .limit(50),
      auth.supabase
        .from("acoes")
        .select("*")
        .eq("negociacao_id", id)
        .order("data", { ascending: true }),
      auth.supabase
        .from("orcamentos")
        .select("id, numero, situacao, valor, criado_em, origem")
        .eq("negociacao_id", id)
        .order("criado_em", { ascending: false }),
    ]);

  return {
    negociacao,
    timeline: interacoes ?? [],
    acoes: acoes ?? [],
    orcamentos: orcamentos ?? [],
  };
}

export function registrarToolsEResources(server: McpServer) {
  server.registerTool(
    "buscar_empresa",
    {
      title: "Buscar empresa",
      description: "Busca até 10 empresas por texto, com negociações abertas.",
      inputSchema: buscarEmpresaArgsSchema,
    },
    async (args, ctx) =>
      comLog("buscar_empresa", args, ctx, async (auth) => {
        const { data: empresas, error } = await auth.supabase
          .from("empresas")
          .select("id, nome, cidade")
          .is("arquivado_em", null)
          .ilike("nome", `%${args.texto}%`)
          .order("nome")
          .limit(10);

        if (error) return texto(error.message, true);

        const resultado = [];
        for (const emp of empresas ?? []) {
          const { count } = await auth.supabase
            .from("negociacoes")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", emp.id)
            .eq("status", "aberta")
            .is("arquivado_em", null);
          resultado.push({
            id: emp.id,
            nome: emp.nome,
            cidade: emp.cidade,
            negociacoes_abertas: count ?? 0,
          });
        }
        return jsonText(resultado);
      }),
  );

  server.registerTool(
    "criar_empresa",
    {
      title: "Criar empresa",
      description:
        "Cria empresa (ou reutiliza existente pelo nome) e contato opcional.",
      inputSchema: criarEmpresaArgsSchema,
    },
    async (args, ctx) =>
      comLog("criar_empresa", args, ctx, async (auth) => {
        const alvo = normalizarNome(args.nome);
        const { data: candidatas } = await auth.supabase
          .from("empresas")
          .select("id, nome, cidade, uf, segmento")
          .is("arquivado_em", null)
          .limit(500);

        let empresa =
          (candidatas ?? []).find((e) => normalizarNome(e.nome) === alvo) ??
          null;
        let criada = false;

        if (!empresa) {
          const { data, error } = await auth.supabase
            .from("empresas")
            .insert({
              nome: args.nome.trim(),
              cidade: args.cidade?.trim() || null,
              uf: args.uf?.trim()?.toUpperCase() || null,
              segmento: args.segmento?.trim() || null,
              responsavel_id: auth.usuario.id,
            })
            .select("id, nome, cidade, uf, segmento")
            .single();
          if (error || !data) return texto(error?.message ?? "Falha.", true);
          empresa = data;
          criada = true;
        }

        let contato = null;
        if (args.contato?.nome) {
          const { data: c, error: errC } = await auth.supabase
            .from("contatos")
            .insert({
              empresa_id: empresa.id,
              nome: args.contato.nome.trim(),
              whatsapp: args.contato.whatsapp?.trim() || null,
              cargo: args.contato.cargo?.trim() || null,
            })
            .select("id, nome, whatsapp, cargo")
            .single();
          if (errC) return texto(errC.message, true);
          contato = c;
        }

        return texto(
          `${criada ? "Criada" : "Reutilizada"} empresa ${empresa.nome}` +
            (contato ? ` com contato ${contato.nome}` : "") +
            `. id=${empresa.id}`,
        );
      }),
  );

  server.registerTool(
    "listar_negociacoes",
    {
      title: "Listar negociações",
      description: "Lista negociações da view v_negociacoes com filtros.",
      inputSchema: listarNegociacoesArgsSchema,
    },
    async (args, ctx) =>
      comLog("listar_negociacoes", args, ctx, async (auth) => {
        let query = auth.supabase.from("v_negociacoes").select("*");

        if (args.status) query = query.eq("status", args.status);
        if (args.funil) query = query.ilike("funil_nome", args.funil);
        if (args.etapa) query = query.ilike("etapa_nome", args.etapa);
        if (args.parada_ha_dias != null) {
          query = query.gte("dias_sem_interacao", args.parada_ha_dias);
        }

        if (args.responsavel_email) {
          const { data: u } = await auth.supabase
            .from("usuarios")
            .select("id")
            .eq("email", args.responsavel_email.trim().toLowerCase())
            .maybeSingle();
          if (!u) return jsonText([]);
          query = query.eq("responsavel_id", u.id);
        }

        const { data, error } = await query
          .order("atualizado_em", { ascending: false })
          .limit(args.limite);

        if (error) return texto(error.message, true);
        return jsonText(data ?? []);
      }),
  );

  server.registerTool(
    "obter_negociacao",
    {
      title: "Obter negociação",
      description: "Ficha completa + timeline + ações + orçamentos.",
      inputSchema: obterNegociacaoArgsSchema,
    },
    async (args, ctx) =>
      comLog("obter_negociacao", args, ctx, async (auth) => {
        try {
          const ficha = await obterFicha(auth, args.id);
          return jsonText(ficha);
        } catch (e) {
          return texto(e instanceof Error ? e.message : "Erro", true);
        }
      }),
  );

  server.registerTool(
    "criar_negociacao",
    {
      title: "Criar negociação",
      description: "Cria negociação aberta para uma empresa.",
      inputSchema: criarNegociacaoArgsSchema,
    },
    async (args, ctx) =>
      comLog("criar_negociacao", args, ctx, async (auth) => {
        let empresaId = args.empresa_id ?? null;
        let empresaNome = "";

        if (!empresaId && args.empresa_nome) {
          const alvo = normalizarNome(args.empresa_nome);
          const { data: candidatas } = await auth.supabase
            .from("empresas")
            .select("id, nome")
            .is("arquivado_em", null)
            .limit(500);
          const hit = (candidatas ?? []).find(
            (e) => normalizarNome(e.nome) === alvo,
          );
          if (hit) {
            empresaId = hit.id;
            empresaNome = hit.nome;
          } else {
            const { data: nova, error } = await auth.supabase
              .from("empresas")
              .insert({
                nome: args.empresa_nome.trim(),
                responsavel_id: auth.usuario.id,
              })
              .select("id, nome")
              .single();
            if (error || !nova) {
              return texto(error?.message ?? "Falha ao criar empresa.", true);
            }
            empresaId = nova.id;
            empresaNome = nova.nome;
          }
        } else if (empresaId) {
          const { data: emp } = await auth.supabase
            .from("empresas")
            .select("id, nome")
            .eq("id", empresaId)
            .maybeSingle();
          if (!emp) return texto("Empresa não encontrada.", true);
          empresaNome = emp.nome;
        }

        if (!empresaId) return texto("Empresa obrigatória.", true);

        const { data: funil } = args.funil
          ? await auth.supabase
              .from("funis")
              .select("id, nome")
              .eq("ativo", true)
              .ilike("nome", args.funil)
              .limit(1)
              .maybeSingle()
          : await auth.supabase
              .from("funis")
              .select("id, nome")
              .eq("ativo", true)
              .order("ordem", { ascending: true })
              .limit(1)
              .maybeSingle();
        if (!funil) return texto("Funil não encontrado.", true);

        const { data: etapa } = await auth.supabase
          .from("etapas")
          .select("id, nome")
          .eq("funil_id", funil.id)
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!etapa) return texto("Funil sem etapas ativas.", true);

        const linha = args.linha?.trim() || null;
        const titulo = linha ? `[${linha}] ${empresaNome}` : empresaNome;
        const previsao = args.previsao_mes
          ? `${args.previsao_mes.slice(0, 7)}-01`
          : inicioProximoMesISO();

        const { data: criada, error } = await auth.supabase
          .from("negociacoes")
          .insert({
            empresa_id: empresaId,
            funil_id: funil.id,
            etapa_id: etapa.id,
            titulo,
            linha,
            origem: args.origem?.trim() || null,
            valor_estimado: args.valor_estimado,
            temperatura: args.temperatura ?? 2,
            previsao_mes: previsao,
            responsavel_id: auth.usuario.id,
            status: "aberta",
          })
          .select("id")
          .single();

        if (error || !criada) {
          return texto(error?.message ?? "Falha ao criar.", true);
        }

        if (args.proxima_acao?.descricao) {
          await auth.supabase.from("acoes").insert({
            negociacao_id: criada.id,
            descricao: args.proxima_acao.descricao,
            data: args.proxima_acao.data,
            tipo: args.proxima_acao.tipo ?? "ligar",
            responsavel_id: auth.usuario.id,
          });
        }

        await auth.supabase.from("interacoes").insert({
          negociacao_id: criada.id,
          tipo: "anotacao",
          texto: prefixoAgente(
            `Negociação criada: ${formatarMoeda(args.valor_estimado)}, funil ${funil.nome}`,
          ),
          usuario_id: auth.usuario.id,
          origem_agente: true,
        });

        return texto(
          `Criada negociação para ${empresaNome}, ${formatarMoeda(args.valor_estimado)}, funil ${funil.nome}. id=${criada.id}`,
        );
      }),
  );

  server.registerTool(
    "registrar_interacao",
    {
      title: "Registrar interação",
      description: "Registra ligação, WhatsApp, visita etc. na timeline.",
      inputSchema: registrarInteracaoArgsSchema,
    },
    async (args, ctx) =>
      comLog("registrar_interacao", args, ctx, async (auth) => {
        const { data: neg } = await auth.supabase
          .from("v_negociacoes")
          .select("id, empresa_nome, titulo")
          .eq("id", args.negociacao_id)
          .maybeSingle();
        if (!neg) return texto("Negociação não encontrada.", true);

        const { error } = await auth.supabase.from("interacoes").insert({
          negociacao_id: args.negociacao_id,
          tipo: args.tipo,
          texto: prefixoAgente(args.texto),
          usuario_id: auth.usuario.id,
          origem_agente: true,
        });
        if (error) return texto(error.message, true);

        return texto(
          `Interação (${args.tipo}) registrada em ${neg.empresa_nome ?? neg.titulo}.`,
        );
      }),
  );

  server.registerTool(
    "criar_acao",
    {
      title: "Criar ação",
      description: "Cria próxima ação em uma negociação.",
      inputSchema: criarAcaoArgsSchema,
    },
    async (args, ctx) =>
      comLog("criar_acao", args, ctx, async (auth) => {
        const { data: neg } = await auth.supabase
          .from("v_negociacoes")
          .select("id, empresa_nome, responsavel_id")
          .eq("id", args.negociacao_id)
          .maybeSingle();
        if (!neg) return texto("Negociação não encontrada.", true);

        const { data: acao, error } = await auth.supabase
          .from("acoes")
          .insert({
            negociacao_id: args.negociacao_id,
            descricao: args.descricao,
            data: args.data,
            hora: args.hora || null,
            tipo: args.tipo ?? "ligar",
            responsavel_id: neg.responsavel_id ?? auth.usuario.id,
          })
          .select("id")
          .single();

        if (error || !acao) {
          return texto(error?.message ?? "Falha.", true);
        }

        await auth.supabase.from("interacoes").insert({
          negociacao_id: args.negociacao_id,
          tipo: "anotacao",
          texto: prefixoAgente(
            `Ação criada: ${args.descricao} em ${args.data}`,
          ),
          usuario_id: auth.usuario.id,
          origem_agente: true,
        });

        return texto(
          `Ação criada para ${neg.empresa_nome}: ${args.descricao} (${args.data}). id=${acao.id}`,
        );
      }),
  );

  server.registerTool(
    "concluir_acao",
    {
      title: "Concluir ação",
      description: "Conclui uma ação e opcionalmente agenda a próxima.",
      inputSchema: concluirAcaoArgsSchema,
    },
    async (args, ctx) =>
      comLog("concluir_acao", args, ctx, async (auth) => {
        const { data: acao } = await auth.supabase
          .from("acoes")
          .select("id, negociacao_id, descricao, concluida_em")
          .eq("id", args.acao_id)
          .maybeSingle();
        if (!acao) return texto("Ação não encontrada.", true);
        if (acao.concluida_em) return texto("Ação já concluída.", true);

        const { error } = await auth.supabase
          .from("acoes")
          .update({ concluida_em: new Date().toISOString() })
          .eq("id", acao.id);
        if (error) return texto(error.message, true);

        if (args.proxima?.descricao) {
          const { data: neg } = await auth.supabase
            .from("negociacoes")
            .select("responsavel_id")
            .eq("id", acao.negociacao_id)
            .maybeSingle();
          await auth.supabase.from("acoes").insert({
            negociacao_id: acao.negociacao_id,
            descricao: args.proxima.descricao,
            data: args.proxima.data,
            tipo: "ligar",
            responsavel_id: neg?.responsavel_id ?? auth.usuario.id,
          });
        }

        await auth.supabase.from("interacoes").insert({
          negociacao_id: acao.negociacao_id,
          tipo: "anotacao",
          texto: prefixoAgente(`Ação concluída: ${acao.descricao}`),
          usuario_id: auth.usuario.id,
          origem_agente: true,
        });

        return texto(`Ação concluída: ${acao.descricao}.`);
      }),
  );

  server.registerTool(
    "mover_etapa",
    {
      title: "Mover etapa",
      description: "Move a negociação para outra etapa (nome ou id).",
      inputSchema: moverEtapaArgsSchema,
    },
    async (args, ctx) =>
      comLog("mover_etapa", args, ctx, async (auth) => {
        const { data: neg } = await auth.supabase
          .from("v_negociacoes")
          .select("id, funil_id, empresa_nome, valor_estimado, etapa_nome")
          .eq("id", args.negociacao_id)
          .maybeSingle();
        if (!neg?.id) return texto("Negociação não encontrada.", true);

        const uuidCheck = z.uuid().safeParse(args.etapa);
        let etapaId: string | null = null;
        let etapaNome = args.etapa;

        if (uuidCheck.success) {
          const { data: et } = await auth.supabase
            .from("etapas")
            .select("id, nome, funil_id, ativo")
            .eq("id", uuidCheck.data)
            .maybeSingle();
          if (!et || !et.ativo || et.funil_id !== neg.funil_id) {
            return texto("Etapa inválida para este funil.", true);
          }
          etapaId = et.id;
          etapaNome = et.nome;
        } else {
          const { data: et } = await auth.supabase
            .from("etapas")
            .select("id, nome")
            .eq("funil_id", neg.funil_id!)
            .eq("ativo", true)
            .ilike("nome", args.etapa)
            .maybeSingle();
          if (!et) return texto("Etapa não encontrada.", true);
          etapaId = et.id;
          etapaNome = et.nome;
        }

        const { error } = await auth.supabase
          .from("negociacoes")
          .update({ etapa_id: etapaId })
          .eq("id", neg.id);
        if (error) return texto(error.message, true);

        await auth.supabase.from("interacoes").insert({
          negociacao_id: neg.id,
          tipo: "anotacao",
          texto: prefixoAgente(
            `Moveu de "${neg.etapa_nome}" para "${etapaNome}"`,
          ),
          usuario_id: auth.usuario.id,
          origem_agente: true,
        });

        return texto(
          `Negociação ${neg.empresa_nome} (${formatarMoeda(neg.valor_estimado)}) movida para ${etapaNome}.`,
        );
      }),
  );

  server.registerTool(
    "fechar_negociacao",
    {
      title: "Fechar negociação",
      description: "Marca como vendida ou perdida (uma por vez).",
      inputSchema: fecharNegociacaoArgsSchema,
    },
    async (args, ctx) =>
      comLog("fechar_negociacao", args, ctx, async (auth) => {
        const { data: neg } = await auth.supabase
          .from("v_negociacoes")
          .select("id, empresa_nome, valor_estimado, status")
          .eq("id", args.negociacao_id)
          .maybeSingle();
        if (!neg?.id) return texto("Negociação não encontrada.", true);
        if (neg.status !== "aberta") {
          return texto("Negociação já fechada.", true);
        }

        if (args.resultado === "vendida") {
          if (args.valor_final == null) {
            return texto("valor_final é obrigatório para venda.", true);
          }
          const { error } = await auth.supabase
            .from("negociacoes")
            .update({
              status: "vendida",
              valor_final: args.valor_final,
              fechado_em: new Date().toISOString(),
              anotacao_fechamento: args.anotacao?.trim() || null,
            })
            .eq("id", neg.id);
          if (error) return texto(error.message, true);

          await auth.supabase.from("interacoes").insert({
            negociacao_id: neg.id,
            tipo: "anotacao",
            texto: prefixoAgente(
              args.anotacao ??
                `Vendida: ${formatarMoeda(args.valor_final)}`,
            ),
            usuario_id: auth.usuario.id,
            origem_agente: true,
          });

          return texto(
            `Negociação ${neg.empresa_nome} marcada como vendida: ${formatarMoeda(args.valor_final)}.`,
          );
        }

        if (!args.motivo?.trim()) {
          return texto("motivo é obrigatório para perda.", true);
        }
        const { error } = await auth.supabase
          .from("negociacoes")
          .update({
            status: "perdida",
            motivo_perda: args.motivo.trim(),
            fechado_em: new Date().toISOString(),
            anotacao_fechamento: args.anotacao?.trim() || null,
          })
          .eq("id", neg.id);
        if (error) return texto(error.message, true);

        await auth.supabase.from("interacoes").insert({
          negociacao_id: neg.id,
          tipo: "anotacao",
          texto: prefixoAgente(
            args.anotacao ?? `Perdida: ${args.motivo.trim()}`,
          ),
          usuario_id: auth.usuario.id,
          origem_agente: true,
        });

        return texto(
          `Negociação ${neg.empresa_nome} (${formatarMoeda(neg.valor_estimado)}) marcada como perdida: ${args.motivo.trim()}.`,
        );
      }),
  );

  server.registerTool(
    "relatorio_presidencia",
    {
      title: "Relatório da presidência",
      description: "JSON do relatório mensal (função SQL).",
      inputSchema: relatorioPresidenciaArgsSchema,
    },
    async (args, ctx) =>
      comLog("relatorio_presidencia", args, ctx, async (auth) => {
        const p_mes = args.mes ? `${args.mes}-01` : undefined;
        const { data, error } = await auth.supabase.rpc(
          "relatorio_presidencia",
          p_mes ? { p_mes } : {},
        );
        if (error) return texto(error.message, true);
        return jsonText(data);
      }),
  );

  server.registerTool(
    "previsao",
    {
      title: "Previsão",
      description: "Linhas de v_previsao para os próximos meses.",
      inputSchema: previsaoArgsSchema,
    },
    async (args, ctx) =>
      comLog("previsao", args, ctx, async (auth) => {
        const { data, error } = await auth.supabase
          .from("v_previsao")
          .select("*")
          .order("mes", { ascending: true })
          .limit(args.meses * 20);
        if (error) return texto(error.message, true);

        const mesesUnicos: string[] = [];
        for (const row of data ?? []) {
          const m = row.mes?.slice(0, 7);
          if (m && !mesesUnicos.includes(m)) mesesUnicos.push(m);
          if (mesesUnicos.length >= args.meses) break;
        }
        const permitidos = new Set(mesesUnicos.slice(0, args.meses));
        const filtrado = (data ?? []).filter((r) =>
          permitidos.has(r.mes?.slice(0, 7) ?? ""),
        );
        return jsonText(filtrado);
      }),
  );

  server.registerTool(
    "buscar_produto",
    {
      title: "Buscar produto",
      description: "Busca até 10 produtos ativos por texto.",
      inputSchema: buscarProdutoArgsSchema,
    },
    async (args, ctx) =>
      comLog("buscar_produto", args, ctx, async (auth) => {
        const { data, error } = await auth.supabase
          .from("produtos")
          .select("id, codigo, nome, unidade, preco_base")
          .eq("ativo", true)
          .or(`nome.ilike.%${args.texto}%,codigo.ilike.%${args.texto}%`)
          .order("nome")
          .limit(10);
        if (error) return texto(error.message, true);
        return jsonText(data ?? []);
      }),
  );

  server.registerTool(
    "montar_orcamento",
    {
      title: "Montar orçamento",
      description: "Disponível na entrega 3 (stub).",
      inputSchema: montarOrcamentoArgsSchema,
    },
    async (args, ctx) =>
      comLog("montar_orcamento", args, ctx, async () =>
        texto("montar_orcamento disponível na entrega 3"),
      ),
  );

  server.registerResource(
    "funis",
    "crm://funis",
    {
      description: "Funis e etapas ativas",
      mimeType: "application/json",
    },
    async (_uri, ctx) => {
      const auth = await autenticarDoCtx(ctx as ToolCtx);
      const { data: funis } = await auth.supabase
        .from("funis")
        .select("id, nome, ativo, ordem")
        .eq("ativo", true)
        .order("ordem");
      const { data: etapas } = await auth.supabase
        .from("etapas")
        .select("id, funil_id, nome, ordem, ativo, dica, conta_como_proposta")
        .eq("ativo", true)
        .order("ordem");
      const payload = { funis: funis ?? [], etapas: etapas ?? [] };
      return {
        contents: [
          {
            uri: "crm://funis",
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "listas",
    "crm://listas",
    {
      description: "Listas por tipo",
      mimeType: "application/json",
    },
    async (_uri, ctx) => {
      const auth = await autenticarDoCtx(ctx as ToolCtx);
      const { data } = await auth.supabase
        .from("listas")
        .select("id, tipo, valor, ordem, ativo")
        .eq("ativo", true)
        .order("tipo")
        .order("ordem");
      return {
        contents: [
          {
            uri: "crm://listas",
            mimeType: "application/json",
            text: JSON.stringify(data ?? [], null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "negociacao",
    new ResourceTemplate("crm://negociacao/{id}", { list: undefined }),
    {
      description: "Ficha completa de uma negociação",
      mimeType: "application/json",
    },
    async (uri, variables, ctx) => {
      const auth = await autenticarDoCtx(ctx as ToolCtx);
      const id = String(
        (variables as { id?: string }).id ?? "",
      );
      if (!z.uuid().safeParse(id).success) {
        throw new Error("id inválido");
      }
      const ficha = await obterFicha(auth, id);
      return {
        contents: [
          {
            uri: String(uri),
            mimeType: "application/json",
            text: JSON.stringify(ficha, null, 2),
          },
        ],
      };
    },
  );
}
