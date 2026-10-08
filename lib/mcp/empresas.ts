import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";

import { apenasDigitosCnpj } from "@/lib/cnpj";
import {
  CAMPOS_CONTATO_MCP,
  CAMPOS_EMPRESA_MCP,
  ROTULO_CAMPO_CONTATO,
  ROTULO_CAMPO_EMPRESA,
  acharPorNome,
  camposContatoAlterados,
  camposEmpresaAlterados,
  decidirEmpresaExistente,
  filtroBuscaEmpresa,
  juntarRotulos,
  paraLinhaEmpresa,
  principalDe,
  type CampoContatoMcp,
  type CampoEmpresaMcp,
} from "@/lib/empresas/cadastro";
import type { McpAuthContext } from "@/lib/mcp-auth";
import type {
  adicionarContatoArgsSchema,
  atualizarContatoArgsSchema,
  atualizarEmpresaArgsSchema,
  buscarEmpresaArgsSchema,
  criarEmpresaArgsSchema,
} from "@/lib/schemas/mcp";

import { prefixoAgente } from "./agente";

type Auth = McpAuthContext;

const SELECT_EMPRESA =
  "id, nome, razao_social, nome_fantasia, cnpj, inscricao_estadual, logradouro, numero, complemento, bairro, cep, cidade, municipio, uf, telefone, email, site, atividade_principal, segmento, observacoes, responsavel_id, atualizado_em";

const SELECT_CONTATO =
  "id, empresa_id, nome, cargo, telefone, whatsapp, email, principal";

const SELECT_NEGOCIACAO =
  "id, titulo, status, valor_estimado, valor_final, etapa_nome, funil_nome, emitente_nome, temperatura, previsao_mes, responsavel_nome";

function texto(content: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text: content }], isError };
}

function jsonText(data: unknown): CallToolResult {
  return texto(JSON.stringify(data, null, 2));
}

function msgErro(error: { message: string; code?: string }): string {
  if (error.code === "23505") {
    const m = error.message.toLowerCase();
    if (m.includes("cnpj")) return "CNPJ já cadastrado em outra empresa.";
    if (m.includes("nome")) return "Já existe uma empresa com esse nome.";
    if (m.includes("principal")) {
      return "Já existe um contato principal nesta empresa.";
    }
  }
  return error.message;
}

type EmpresaRow = {
  id: string;
  nome: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  atividade_principal: string | null;
  segmento: string | null;
  observacoes: string | null;
  responsavel_id: string | null;
  atualizado_em: string;
};

type ContatoRow = {
  id: string;
  empresa_id: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  principal: boolean;
};

function contatoPublico(c: ContatoRow) {
  return {
    id: c.id,
    empresa_id: c.empresa_id,
    nome: c.nome,
    cargo: c.cargo,
    telefone: c.telefone,
    whatsapp: c.whatsapp,
    email: c.email,
    principal: principalDe(c.principal),
  };
}

function camposDeArgs(
  args: Partial<Record<CampoEmpresaMcp, string | null | undefined>>,
): Partial<Record<CampoEmpresaMcp, string | null>> {
  const out: Partial<Record<CampoEmpresaMcp, string | null>> = {};
  for (const campo of CAMPOS_EMPRESA_MCP) {
    if (args[campo] !== undefined) out[campo] = args[campo] ?? null;
  }
  return out;
}

async function empresaPorNome(auth: Auth, nome: string) {
  const { data, error } = await auth.supabase.rpc("empresa_ativa_por_nome", {
    p_nome: nome,
  });
  if (error) return { erro: error.message as string };
  const row = data?.[0];
  return { empresa: row ? { id: row.id, nome: row.nome } : null };
}

async function empresaPorCnpj(auth: Auth, cnpj: string | null | undefined) {
  if (!cnpj) return { empresa: null as { id: string; nome: string } | null };
  const digitos = apenasDigitosCnpj(cnpj);
  if (!digitos) return { empresa: null };
  const { data, error } = await auth.supabase
    .from("empresas")
    .select("id, nome")
    .is("arquivado_em", null)
    .eq("cnpj_digitos", digitos)
    .maybeSingle();
  if (error) return { erro: error.message };
  return { empresa: data };
}

async function registrarTimeline(
  auth: Auth,
  empresaId: string,
  frase: string,
): Promise<string | null> {
  const { error } = await auth.supabase.from("interacoes").insert({
    empresa_id: empresaId,
    negociacao_id: null,
    tipo: "anotacao",
    texto: prefixoAgente(frase),
    usuario_id: auth.usuario.id,
    origem_agente: true,
  });
  return error ? msgErro(error) : null;
}

async function lerFicha(auth: Auth, id: string) {
  const { data: empresa, error } = await auth.supabase
    .from("empresas")
    .select(SELECT_EMPRESA)
    .eq("id", id)
    .is("arquivado_em", null)
    .maybeSingle();
  if (error) return { erro: error.message };
  if (!empresa) return { erro: "Empresa não encontrada." };

  const [{ data: contatos, error: erroC }, { data: negociacoes, error: erroN }, { data: timeline, error: erroT }] =
    await Promise.all([
      auth.supabase
        .from("contatos")
        .select(SELECT_CONTATO)
        .eq("empresa_id", id)
        .is("arquivado_em", null)
        .order("principal", { ascending: false })
        .order("nome"),
      auth.supabase
        .from("v_negociacoes")
        .select(SELECT_NEGOCIACAO)
        .eq("empresa_id", id)
        .order("atualizado_em", { ascending: false })
        .limit(50),
      auth.supabase
        .from("interacoes")
        .select("id, tipo, texto, origem_agente, criado_em")
        .eq("empresa_id", id)
        .is("negociacao_id", null)
        .order("criado_em", { ascending: false })
        .limit(30),
    ]);
  if (erroC) return { erro: erroC.message };
  if (erroN) return { erro: erroN.message };
  if (erroT) return { erro: erroT.message };

  return {
    ficha: {
      empresa: empresa as EmpresaRow,
      contatos: ((contatos ?? []) as ContatoRow[]).map(contatoPublico),
      negociacoes: negociacoes ?? [],
      timeline: timeline ?? [],
    },
  };
}

async function desmarcarPrincipal(auth: Auth, empresaId: string, excetoId?: string) {
  let q = auth.supabase
    .from("contatos")
    .update({ principal: false })
    .eq("empresa_id", empresaId)
    .eq("principal", true)
    .is("arquivado_em", null);
  if (excetoId) q = q.neq("id", excetoId);
  const { error } = await q;
  return error ? msgErro(error) : null;
}

type ContatoInput = {
  nome: string;
  cargo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  principal?: boolean;
};

async function inserirContato(auth: Auth, empresaId: string, contato: ContatoInput) {
  const { data: existentes, error: erroLista } = await auth.supabase
    .from("contatos")
    .select(SELECT_CONTATO)
    .eq("empresa_id", empresaId)
    .is("arquivado_em", null);
  if (erroLista) return { erro: erroLista.message };

  const ja = acharPorNome((existentes ?? []) as ContatoRow[], contato.nome);
  if (ja) {
    return {
      criado: false as const,
      contato: contatoPublico(ja),
      aviso: `Contato já existia nesta empresa: ${ja.nome}. id=${ja.id}. Nada foi duplicado. Use atualizar_contato para alterar.`,
    };
  }

  if (contato.principal) {
    const erroPrincipal = await desmarcarPrincipal(auth, empresaId);
    if (erroPrincipal) return { erro: erroPrincipal };
  }

  const { data, error } = await auth.supabase
    .from("contatos")
    .insert({
      empresa_id: empresaId,
      nome: contato.nome.trim(),
      cargo: contato.cargo ?? null,
      telefone: contato.telefone ?? null,
      whatsapp: contato.whatsapp ?? null,
      email: contato.email ?? null,
      principal: contato.principal ?? false,
    })
    .select(SELECT_CONTATO)
    .single();
  if (error || !data) return { erro: error ? msgErro(error) : "Falha ao criar contato." };

  const frase = `Contato adicionado: ${data.nome}${data.cargo ? ` (${data.cargo})` : ""}.`;
  const erroTimeline = await registrarTimeline(auth, empresaId, frase);
  return {
    criado: true as const,
    contato: contatoPublico(data as ContatoRow),
    avisoTimeline: erroTimeline,
  };
}

export async function executarBuscarEmpresa(
  auth: Auth,
  args: z.infer<typeof buscarEmpresaArgsSchema>,
): Promise<CallToolResult> {
  const filtro = filtroBuscaEmpresa(args.texto);
  if (filtro.modo === "nome" && filtro.nome.length < 2) {
    return texto("Informe ao menos 2 letras do nome ou um CNPJ.", true);
  }
  const base = () =>
    auth.supabase
      .from("empresas")
      .select("id, nome, cidade, cnpj")
      .is("arquivado_em", null);

  let empresas: { id: string; nome: string; cidade: string | null; cnpj: string | null }[] =
    [];
  if (filtro.modo === "ambos") {
    const [porNome, porCnpj] = await Promise.all([
      base().ilike("nome", `%${filtro.nome}%`).order("nome").limit(10),
      base().ilike("cnpj_digitos", `%${filtro.digitos}%`).order("nome").limit(10),
    ]);
    if (porNome.error) return texto(porNome.error.message, true);
    if (porCnpj.error) return texto(porCnpj.error.message, true);
    const vistos = new Set<string>();
    for (const emp of [...(porNome.data ?? []), ...(porCnpj.data ?? [])]) {
      if (vistos.has(emp.id)) continue;
      vistos.add(emp.id);
      empresas.push(emp);
      if (empresas.length >= 10) break;
    }
  } else {
    const query =
      filtro.modo === "cnpj"
        ? base().ilike("cnpj_digitos", `%${filtro.digitos}%`)
        : base().ilike("nome", `%${filtro.nome}%`);
    const { data, error } = await query.order("nome").limit(10);
    if (error) return texto(error.message, true);
    empresas = data ?? [];
  }

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
      cnpj: emp.cnpj,
      negociacoes_abertas: count ?? 0,
    });
  }
  return jsonText(resultado);
}

export async function executarCriarEmpresa(
  auth: Auth,
  args: z.infer<typeof criarEmpresaArgsSchema>,
): Promise<CallToolResult> {
  const porNome = await empresaPorNome(auth, args.nome);
  if ("erro" in porNome && porNome.erro) return texto(porNome.erro, true);
  const porCnpj = await empresaPorCnpj(auth, args.cnpj);
  if ("erro" in porCnpj && porCnpj.erro) return texto(porCnpj.erro, true);

  const decisao = decidirEmpresaExistente(
    porNome.empresa ?? null,
    porCnpj.empresa ?? null,
  );
  if (decisao.tipo === "conflito") return texto(decisao.erro, true);

  if (decisao.tipo === "existente") {
    const lida = await lerFicha(auth, decisao.empresa.id);
    if ("erro" in lida && lida.erro) return texto(lida.erro, true);
    const aviso = args.contato?.nome
      ? `${decisao.aviso} O contato "${args.contato.nome}" não foi gravado. Use adicionar_contato.`
      : `${decisao.aviso} Para alterar a ficha, use atualizar_empresa.`;
    return jsonText({
      mensagem: aviso,
      aviso,
      criada: false,
      ...("ficha" in lida ? lida.ficha : {}),
    });
  }

  const linha = paraLinhaEmpresa(camposDeArgs(args));
  const { data: criada, error } = await auth.supabase
    .from("empresas")
    .insert({
      ...linha,
      nome: args.nome.trim(),
      responsavel_id: auth.usuario.id,
    })
    .select("id, nome")
    .single();

  if (error || !criada) {
    if (error?.code === "23505") {
      const deNovoNome = await empresaPorNome(auth, args.nome);
      const deNovoCnpj = await empresaPorCnpj(auth, args.cnpj);
      const retry = decidirEmpresaExistente(
        "empresa" in deNovoNome ? (deNovoNome.empresa ?? null) : null,
        "empresa" in deNovoCnpj ? (deNovoCnpj.empresa ?? null) : null,
      );
      if (retry.tipo === "existente") {
        const lida = await lerFicha(auth, retry.empresa.id);
        if ("ficha" in lida) {
          return jsonText({
            mensagem: retry.aviso,
            aviso: retry.aviso,
            criada: false,
            ...lida.ficha,
          });
        }
      }
    }
    return texto(error ? msgErro(error) : "Falha ao criar empresa.", true);
  }

  const erroTimeline = await registrarTimeline(
    auth,
    criada.id,
    `Empresa criada: ${criada.nome}.`,
  );

  let avisoContato: string | undefined;
  if (args.contato?.nome) {
    const gravado = await inserirContato(auth, criada.id, args.contato);
    if ("erro" in gravado && gravado.erro) {
      avisoContato = `Empresa criada, mas o contato falhou: ${gravado.erro}`;
    } else if ("aviso" in gravado && gravado.aviso) {
      avisoContato = gravado.aviso;
    }
  }

  const lida = await lerFicha(auth, criada.id);
  if ("erro" in lida && lida.erro) return texto(lida.erro, true);

  const mensagem = `Criada empresa ${criada.nome}. id=${criada.id}`;
  return jsonText({
    mensagem,
    criada: true,
    ...(avisoContato ? { aviso: avisoContato } : {}),
    ...(erroTimeline
      ? { aviso_timeline: `Ficha gravada, mas a timeline não foi registrada: ${erroTimeline}` }
      : {}),
    ...("ficha" in lida ? lida.ficha : {}),
  });
}

export async function executarAtualizarEmpresa(
  auth: Auth,
  args: z.infer<typeof atualizarEmpresaArgsSchema>,
): Promise<CallToolResult> {
  const { data: atual, error: erroAtual } = await auth.supabase
    .from("empresas")
    .select(SELECT_EMPRESA)
    .eq("id", args.empresa_id)
    .is("arquivado_em", null)
    .maybeSingle();
  if (erroAtual) return texto(erroAtual.message, true);
  if (!atual) return texto("Empresa não encontrada.", true);

  const linha = paraLinhaEmpresa(camposDeArgs(args));

  if (linha.cnpj) {
    const dono = await empresaPorCnpj(auth, linha.cnpj);
    if ("erro" in dono && dono.erro) return texto(dono.erro, true);
    if (dono.empresa && dono.empresa.id !== atual.id) {
      return texto(
        `CNPJ já cadastrado na empresa "${dono.empresa.nome}" (id=${dono.empresa.id}).`,
        true,
      );
    }
  }
  if (linha.nome) {
    const dono = await empresaPorNome(auth, linha.nome);
    if ("erro" in dono && dono.erro) return texto(dono.erro, true);
    if (dono.empresa && dono.empresa.id !== atual.id) {
      return texto(
        `Já existe a empresa "${dono.empresa.nome}" (id=${dono.empresa.id}) com esse nome.`,
        true,
      );
    }
  }

  const alterados = camposEmpresaAlterados(atual as EmpresaRow, linha);
  if (alterados.length === 0) {
    const lida = await lerFicha(auth, atual.id);
    if ("erro" in lida && lida.erro) return texto(lida.erro, true);
    return jsonText({
      mensagem: `Nenhum campo mudou em ${atual.nome}.`,
      ...("ficha" in lida ? lida.ficha : {}),
    });
  }

  const { nome: nomeNovo, ...restoLinha } = linha;
  const { data: salva, error } = await auth.supabase
    .from("empresas")
    .update(nomeNovo ? { ...restoLinha, nome: nomeNovo } : restoLinha)
    .eq("id", atual.id)
    .select("id, nome")
    .maybeSingle();
  if (error) return texto(msgErro(error), true);
  if (!salva) return texto("Sem permissão para editar esta empresa.", true);

  const rotulos = alterados.map((c) => ROTULO_CAMPO_EMPRESA[c]);
  const erroTimeline = await registrarTimeline(
    auth,
    salva.id,
    `Empresa atualizada (${salva.nome}): ${juntarRotulos(rotulos)}.`,
  );

  const lida = await lerFicha(auth, salva.id);
  if ("erro" in lida && lida.erro) return texto(lida.erro, true);
  return jsonText({
    mensagem: `Empresa atualizada: ${salva.nome}.`,
    alterados,
    ...(erroTimeline
      ? { aviso_timeline: `Ficha gravada, mas a timeline não foi registrada: ${erroTimeline}` }
      : {}),
    ...("ficha" in lida ? lida.ficha : {}),
  });
}

export async function executarObterEmpresa(
  auth: Auth,
  args: { id: string },
): Promise<CallToolResult> {
  const lida = await lerFicha(auth, args.id);
  if ("erro" in lida && lida.erro) return texto(lida.erro, true);
  return jsonText("ficha" in lida ? lida.ficha : {});
}

export async function executarAdicionarContato(
  auth: Auth,
  args: z.infer<typeof adicionarContatoArgsSchema>,
): Promise<CallToolResult> {
  const { data: empresa, error } = await auth.supabase
    .from("empresas")
    .select("id, nome")
    .eq("id", args.empresa_id)
    .is("arquivado_em", null)
    .maybeSingle();
  if (error) return texto(error.message, true);
  if (!empresa) return texto("Empresa não encontrada.", true);

  const gravado = await inserirContato(auth, empresa.id, args);
  if ("erro" in gravado && gravado.erro) return texto(gravado.erro, true);
  if (!("contato" in gravado)) return texto("Falha ao criar contato.", true);

  if (!gravado.criado) {
    return jsonText({
      mensagem: gravado.aviso,
      aviso: gravado.aviso,
      criado: false,
      contato: gravado.contato,
    });
  }

  return jsonText({
    mensagem: `Contato ${gravado.contato.nome} adicionado em ${empresa.nome}. id=${gravado.contato.id}`,
    criado: true,
    contato: gravado.contato,
    ...("avisoTimeline" in gravado && gravado.avisoTimeline
      ? { aviso_timeline: gravado.avisoTimeline }
      : {}),
  });
}

export async function executarAtualizarContato(
  auth: Auth,
  args: z.infer<typeof atualizarContatoArgsSchema>,
): Promise<CallToolResult> {
  const { data: atual, error: erroAtual } = await auth.supabase
    .from("contatos")
    .select(SELECT_CONTATO)
    .eq("id", args.contato_id)
    .is("arquivado_em", null)
    .maybeSingle();
  if (erroAtual) return texto(erroAtual.message, true);
  if (!atual) return texto("Contato não encontrado.", true);
  const contato = atual as ContatoRow;

  const patch: Partial<Record<CampoContatoMcp, string | boolean | null>> = {};
  for (const campo of CAMPOS_CONTATO_MCP) {
    if (args[campo] !== undefined) patch[campo] = args[campo] ?? null;
  }
  if (typeof patch.nome === "string") patch.nome = patch.nome.trim();

  if (typeof patch.nome === "string" && patch.nome !== contato.nome) {
    const { data: irmaos, error: erroIrmaos } = await auth.supabase
      .from("contatos")
      .select("id, nome")
      .eq("empresa_id", contato.empresa_id)
      .is("arquivado_em", null);
    if (erroIrmaos) return texto(erroIrmaos.message, true);
    const outro = acharPorNome(
      (irmaos ?? []).filter((c) => c.id !== contato.id),
      patch.nome,
    );
    if (outro) {
      return texto(
        `Já existe o contato "${outro.nome}" (id=${outro.id}) nesta empresa. Nada foi alterado.`,
        true,
      );
    }
  }

  const alterados = camposContatoAlterados(contato, {
    nome: typeof patch.nome === "string" ? patch.nome : undefined,
    cargo: patch.cargo === undefined ? undefined : (patch.cargo as string | null),
    telefone:
      patch.telefone === undefined ? undefined : (patch.telefone as string | null),
    whatsapp:
      patch.whatsapp === undefined ? undefined : (patch.whatsapp as string | null),
    email: patch.email === undefined ? undefined : (patch.email as string | null),
    principal: typeof patch.principal === "boolean" ? patch.principal : undefined,
  });

  if (alterados.length === 0) {
    return jsonText({
      mensagem: `Nenhum campo mudou no contato ${contato.nome}.`,
      contato: contatoPublico(contato),
    });
  }

  if (patch.principal === true) {
    const erroPrincipal = await desmarcarPrincipal(auth, contato.empresa_id, contato.id);
    if (erroPrincipal) return texto(erroPrincipal, true);
  }

  const update: {
    nome?: string;
    cargo?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    principal?: boolean;
  } = {};
  if (typeof patch.nome === "string") update.nome = patch.nome;
  if (patch.cargo !== undefined) update.cargo = patch.cargo as string | null;
  if (patch.telefone !== undefined) update.telefone = patch.telefone as string | null;
  if (patch.whatsapp !== undefined) update.whatsapp = patch.whatsapp as string | null;
  if (patch.email !== undefined) update.email = patch.email as string | null;
  if (typeof patch.principal === "boolean") update.principal = patch.principal;

  const { data: salvo, error } = await auth.supabase
    .from("contatos")
    .update(update)
    .eq("id", contato.id)
    .select(SELECT_CONTATO)
    .maybeSingle();
  if (error) return texto(msgErro(error), true);
  if (!salvo) return texto("Sem permissão para editar este contato.", true);

  const rotulos = alterados.map((c) => ROTULO_CAMPO_CONTATO[c]);
  const erroTimeline = await registrarTimeline(
    auth,
    contato.empresa_id,
    `Contato atualizado (${salvo.nome}): ${juntarRotulos(rotulos)}.`,
  );

  return jsonText({
    mensagem: `Contato atualizado: ${salvo.nome}.`,
    alterados,
    contato: contatoPublico(salvo as ContatoRow),
    ...(erroTimeline ? { aviso_timeline: erroTimeline } : {}),
  });
}
