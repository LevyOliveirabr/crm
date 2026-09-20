"use server";

import { revalidatePath } from "next/cache";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  mapearLinha,
  parseCsvBytes,
  parseDataCsv,
  parseValorCsv,
  type CsvParseResult,
} from "@/lib/csv";
import { normalizarNome } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type ImportErro = {
  linha: number;
  motivo: string;
  nivel?: "erro" | "aviso";
};

export type ImportRelatorio = {
  importadas: number;
  reutilizadas: number;
  erros: ImportErro[];
};

export type ImportPreview = {
  tipo: TipoImportacao;
  separator: ";" | ",";
  encoding: "utf-8" | "windows-1252";
  headers: string[];
  /** Colunas esperadas × cabeçalho encontrado */
  mapeamento: { esperado: string; encontrado: string | null }[];
  preview: Record<string, string>[];
  totalLinhas: number;
  /** Conteúdo base64 do arquivo para confirmar depois */
  arquivoB64: string;
};

export type TipoImportacao =
  | "empresas"
  | "contatos"
  | "negociacoes"
  | "produtos";

const COLUNAS: Record<TipoImportacao, string[]> = {
  empresas: [
    "nome",
    "cidade",
    "uf",
    "segmento",
    "cnpj",
    "responsavel_email",
    "observacoes",
  ],
  contatos: ["empresa_nome", "nome", "whatsapp", "email", "cargo"],
  negociacoes: [
    "empresa_nome",
    "titulo",
    "valor_estimado",
    "funil_nome",
    "etapa_nome",
    "linha",
    "origem",
    "responsavel_email",
    "status",
    "valor_final",
    "motivo_perda",
    "criado_em",
    "fechado_em",
    "proxima_acao",
    "proxima_acao_data",
  ],
  produtos: ["codigo", "nome", "descricao", "linha", "unidade", "preco_base"],
};

function exigirColunas(
  tipo: TipoImportacao,
  headers: string[],
): { ok: true } | { ok: false; error: string } {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const obrigatorias =
    tipo === "empresas"
      ? ["nome"]
      : tipo === "contatos"
        ? ["empresa_nome", "nome"]
        : tipo === "negociacoes"
          ? ["empresa_nome"]
          : ["nome"];
  const faltando = obrigatorias.filter((c) => !lower.includes(c));
  if (faltando.length) {
    return {
      ok: false,
      error: `Colunas obrigatórias ausentes: ${faltando.join(", ")}.`,
    };
  }
  return { ok: true };
}

function headerLookup(headers: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const h of headers) m.set(h.trim().toLowerCase(), h);
  return m;
}

export async function previaImportacao(
  formData: FormData,
): Promise<
  { ok: true; preview: ImportPreview } | { ok: false; error: string }
> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ehDiretorEmAlguma) {
    return { ok: false, error: "Apenas o diretor pode importar." };
  }

  const tipo = String(formData.get("tipo") ?? "") as TipoImportacao;
  if (!COLUNAS[tipo]) return { ok: false, error: "Tipo de importação inválido." };

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo CSV." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseCsvBytes(bytes);
  const check = exigirColunas(tipo, parsed.headers);
  if (!check.ok) return check;

  const lookup = headerLookup(parsed.headers);
  const mapeamento = COLUNAS[tipo].map((esperado) => ({
    esperado,
    encontrado: lookup.get(esperado) ?? null,
  }));

  const previewRows = parsed.rows.slice(0, 5).map((row) => {
    const raw = mapearLinha(parsed.headers, row);
    const mapped: Record<string, string> = {};
    for (const col of COLUNAS[tipo]) {
      const key = lookup.get(col);
      mapped[col] = key ? (raw[key] ?? "") : "";
    }
    return mapped;
  });

  const arquivoB64 = Buffer.from(bytes).toString("base64");

  return {
    ok: true,
    preview: {
      tipo,
      separator: parsed.separator,
      encoding: parsed.encoding,
      headers: parsed.headers,
      mapeamento,
      preview: previewRows,
      totalLinhas: parsed.rows.length,
      arquivoB64,
    },
  };
}

export async function confirmarImportacao(input: {
  tipo: TipoImportacao;
  arquivoB64: string;
}): Promise<
  { ok: true; relatorio: ImportRelatorio } | { ok: false; error: string }
> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ehDiretorEmAlguma) {
    return { ok: false, error: "Apenas o diretor pode importar." };
  }

  const tipo = input.tipo;
  if (!COLUNAS[tipo]) return { ok: false, error: "Tipo inválido." };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(input.arquivoB64, "base64"));
  } catch {
    return { ok: false, error: "Arquivo inválido. Gere a prévia novamente." };
  }

  const parsed = parseCsvBytes(bytes);
  const check = exigirColunas(tipo, parsed.headers);
  if (!check.ok) return check;

  const supabase = await createClient();
  let relatorio: ImportRelatorio;

  try {
    if (tipo === "empresas") {
      relatorio = await importarEmpresas(supabase, parsed, usuario.id);
    } else if (tipo === "contatos") {
      relatorio = await importarContatos(supabase, parsed);
    } else if (tipo === "negociacoes") {
      relatorio = await importarNegociacoes(supabase, parsed, usuario.id);
    } else {
      relatorio = await importarProdutos(supabase, parsed);
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha na importação.",
    };
  }

  revalidatePath("/configuracoes", "layout");
  revalidatePath("/empresas");
  revalidatePath("/contatos");
  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath("/dashboard");

  return { ok: true, relatorio };
}

type Sb = Awaited<ReturnType<typeof createClient>>;

async function carregarUsuariosPorEmail(supabase: Sb) {
  const { data } = await supabase.from("usuarios").select("id, email");
  const map = new Map<string, string>();
  for (const u of data ?? []) {
    map.set(u.email.trim().toLowerCase(), u.id);
  }
  return map;
}

async function carregarEmpresasPorNome(supabase: Sb) {
  const { data } = await supabase
    .from("empresas")
    .select("id, nome")
    .is("arquivado_em", null);
  const map = new Map<string, { id: string; nome: string }>();
  for (const e of data ?? []) {
    map.set(normalizarNome(e.nome), e);
  }
  return map;
}

async function importarEmpresas(
  supabase: Sb,
  parsed: CsvParseResult,
  usuarioId: string,
): Promise<ImportRelatorio> {
  const erros: ImportErro[] = [];
  const usuarios = await carregarUsuariosPorEmail(supabase);
  const existentes = await carregarEmpresasPorNome(supabase);
  const criadas: string[] = [];
  let importadas = 0;
  let reutilizadas = 0;

  const novas: {
    nome: string;
    cidade: string | null;
    uf: string | null;
    segmento: string | null;
    cnpj: string | null;
    responsavel_id: string | null;
    observacoes: string | null;
  }[] = [];

  try {
    for (let i = 0; i < parsed.rows.length; i++) {
      const linha = parsed.dataLineNumbers[i] ?? i + 2;
      const raw = mapearLinha(parsed.headers, parsed.rows[i]!);
      const get = (k: string) => {
        const key = Object.keys(raw).find(
          (h) => h.trim().toLowerCase() === k,
        );
        return key ? raw[key]!.trim() : "";
      };

      const nome = get("nome");
      if (!nome) {
        erros.push({ linha, motivo: "nome obrigatório", nivel: "erro" });
        continue;
      }

      const chave = normalizarNome(nome);
      if (existentes.has(chave)) {
        reutilizadas++;
        continue;
      }

      const email = get("responsavel_email").toLowerCase();
      const ufRaw = get("uf").toUpperCase();
      novas.push({
        nome,
        cidade: get("cidade") || null,
        uf: ufRaw.length === 2 ? ufRaw : null,
        segmento: get("segmento") || null,
        cnpj: get("cnpj") || null,
        responsavel_id: email
          ? (usuarios.get(email) ?? usuarioId)
          : usuarioId,
        observacoes: get("observacoes") || null,
      });
      // marca para evitar duplicata no mesmo arquivo
      existentes.set(chave, { id: "pending", nome });
    }

    if (novas.length > 0) {
      const { data, error } = await supabase
        .from("empresas")
        .insert(novas)
        .select("id");
      if (error) throw new Error(error.message);
      for (const row of data ?? []) criadas.push(row.id);
      importadas = criadas.length;
    }
  } catch (e) {
    if (criadas.length) {
      await supabase.from("empresas").delete().in("id", criadas);
    }
    throw e;
  }

  return { importadas, reutilizadas, erros };
}

async function importarContatos(
  supabase: Sb,
  parsed: CsvParseResult,
): Promise<ImportRelatorio> {
  const erros: ImportErro[] = [];
  const empresas = await carregarEmpresasPorNome(supabase);
  const criadas: string[] = [];
  let importadas = 0;
  const reutilizadas = 0;

  const novas: {
    empresa_id: string;
    nome: string;
    whatsapp: string | null;
    email: string | null;
    cargo: string | null;
  }[] = [];

  try {
    for (let i = 0; i < parsed.rows.length; i++) {
      const linha = parsed.dataLineNumbers[i] ?? i + 2;
      const raw = mapearLinha(parsed.headers, parsed.rows[i]!);
      const get = (k: string) => {
        const key = Object.keys(raw).find(
          (h) => h.trim().toLowerCase() === k,
        );
        return key ? raw[key]!.trim() : "";
      };

      const empresaNome = get("empresa_nome");
      const nome = get("nome");
      if (!empresaNome || !nome) {
        erros.push({
          linha,
          motivo: "empresa_nome e nome são obrigatórios",
          nivel: "erro",
        });
        continue;
      }

      const emp = empresas.get(normalizarNome(empresaNome));
      if (!emp || emp.id === "pending") {
        erros.push({
          linha,
          motivo: `empresa não encontrada: ${empresaNome}`,
          nivel: "erro",
        });
        continue;
      }

      const wa = get("whatsapp").replace(/\D/g, "") || null;
      novas.push({
        empresa_id: emp.id,
        nome,
        whatsapp: wa,
        email: get("email") || null,
        cargo: get("cargo") || null,
      });
    }

    if (novas.length > 0) {
      const { data, error } = await supabase
        .from("contatos")
        .insert(novas)
        .select("id");
      if (error) throw new Error(error.message);
      for (const row of data ?? []) criadas.push(row.id);
      importadas = criadas.length;
    }
  } catch (e) {
    if (criadas.length) {
      await supabase.from("contatos").delete().in("id", criadas);
    }
    throw e;
  }

  return { importadas, reutilizadas, erros };
}

async function importarNegociacoes(
  supabase: Sb,
  parsed: CsvParseResult,
  usuarioId: string,
): Promise<ImportRelatorio> {
  const erros: ImportErro[] = [];
  const empresas = await carregarEmpresasPorNome(supabase);
  const usuarios = await carregarUsuariosPorEmail(supabase);

  const { data: funis } = await supabase
    .from("funis")
    .select("id, nome")
    .eq("ativo", true)
    .order("ordem");
  const { data: etapas } = await supabase
    .from("etapas")
    .select("id, funil_id, nome, ordem")
    .eq("ativo", true)
    .order("ordem");

  const primeiroFunil = funis?.[0];
  const primeiraEtapa = (etapas ?? [])
    .filter((e) => e.funil_id === primeiroFunil?.id)
    .sort((a, b) => a.ordem - b.ordem)[0];

  if (!primeiroFunil || !primeiraEtapa) {
    throw new Error("Não há funil/etapa ativos para fallback da importação.");
  }

  const criadas: string[] = [];
  const acoesCriadas: string[] = [];
  let importadas = 0;
  const reutilizadas = 0;

  try {
    for (let i = 0; i < parsed.rows.length; i++) {
      const linha = parsed.dataLineNumbers[i] ?? i + 2;
      const raw = mapearLinha(parsed.headers, parsed.rows[i]!);
      const get = (k: string) => {
        const key = Object.keys(raw).find(
          (h) => h.trim().toLowerCase() === k,
        );
        return key ? raw[key]!.trim() : "";
      };

      const empresaNome = get("empresa_nome");
      if (!empresaNome) {
        erros.push({
          linha,
          motivo: "empresa_nome obrigatório",
          nivel: "erro",
        });
        continue;
      }

      const emp = empresas.get(normalizarNome(empresaNome));
      if (!emp) {
        erros.push({
          linha,
          motivo: `empresa não encontrada: ${empresaNome}`,
          nivel: "erro",
        });
        continue;
      }

      const funilNome = get("funil_nome");
      const etapaNome = get("etapa_nome");
      let funil = funilNome
        ? (funis ?? []).find(
            (f) => normalizarNome(f.nome) === normalizarNome(funilNome),
          )
        : undefined;
      let etapa = funil
        ? (etapas ?? []).find(
            (e) =>
              e.funil_id === funil!.id &&
              normalizarNome(e.nome) === normalizarNome(etapaNome || ""),
          )
        : undefined;

      if (!funil || !etapa) {
        funil = primeiroFunil;
        etapa = primeiraEtapa;
        erros.push({
          linha,
          motivo: `funil/etapa não encontrados (${funilNome || "—"} / ${etapaNome || "—"}); usada primeira etapa`,
          nivel: "aviso",
        });
      }

      const valor = parseValorCsv(get("valor_estimado")) ?? 0;
      const statusRaw = get("status").toLowerCase() || "aberta";
      const status =
        statusRaw === "vendida" || statusRaw === "perdida"
          ? statusRaw
          : "aberta";

      const email = get("responsavel_email").toLowerCase();
      const responsavel = email
        ? (usuarios.get(email) ?? usuarioId)
        : usuarioId;

      let titulo = get("titulo");
      const linhaNeg = get("linha") || null;
      if (!titulo) {
        titulo = linhaNeg
          ? `[${linhaNeg}] ${emp.nome}`
          : emp.nome;
      }

      const criadoEm = parseDataCsv(get("criado_em"));
      const fechadoEm = parseDataCsv(get("fechado_em"));
      const valorFinal = parseValorCsv(get("valor_final"));

      const { data: neg, error } = await supabase
        .from("negociacoes")
        .insert({
          empresa_id: emp.id,
          funil_id: funil.id,
          etapa_id: etapa.id,
          titulo,
          linha: linhaNeg,
          origem: get("origem") || null,
          valor_estimado: valor,
          responsavel_id: responsavel,
          status,
          valor_final: valorFinal,
          motivo_perda: get("motivo_perda") || null,
          ...(criadoEm
            ? { criado_em: `${criadoEm}T12:00:00-03:00` }
            : {}),
          ...(fechadoEm
            ? { fechado_em: `${fechadoEm}T12:00:00-03:00` }
            : {}),
        })
        .select("id")
        .single();

      if (error) throw new Error(`Linha ${linha}: ${error.message}`);
      criadas.push(neg.id);
      importadas++;

      const proxAcao = get("proxima_acao");
      const proxData = parseDataCsv(get("proxima_acao_data"));
      if (proxAcao && proxData) {
        const { data: acao, error: acaoErr } = await supabase
          .from("acoes")
          .insert({
            negociacao_id: neg.id,
            descricao: proxAcao,
            data: proxData,
            tipo: "outro",
            responsavel_id: responsavel,
          })
          .select("id")
          .single();
        if (acaoErr) throw new Error(`Linha ${linha}: ${acaoErr.message}`);
        if (acao) acoesCriadas.push(acao.id);
      }
    }
  } catch (e) {
    if (acoesCriadas.length) {
      await supabase.from("acoes").delete().in("id", acoesCriadas);
    }
    if (criadas.length) {
      await supabase.from("negociacoes").delete().in("id", criadas);
    }
    throw e;
  }

  return { importadas, reutilizadas, erros };
}

async function importarProdutos(
  supabase: Sb,
  parsed: CsvParseResult,
): Promise<ImportRelatorio> {
  const erros: ImportErro[] = [];
  const criadas: string[] = [];
  let importadas = 0;
  let reutilizadas = 0;

  const { data: existentes } = await supabase
    .from("produtos")
    .select("id, codigo, nome");
  const porCodigo = new Map<string, string>();
  for (const p of existentes ?? []) {
    if (p.codigo) porCodigo.set(p.codigo.trim().toLowerCase(), p.id);
  }

  const novas: {
    codigo: string | null;
    nome: string;
    descricao: string | null;
    linha: string | null;
    unidade: string;
    preco_base: number;
  }[] = [];

  try {
    for (let i = 0; i < parsed.rows.length; i++) {
      const linha = parsed.dataLineNumbers[i] ?? i + 2;
      const raw = mapearLinha(parsed.headers, parsed.rows[i]!);
      const get = (k: string) => {
        const key = Object.keys(raw).find(
          (h) => h.trim().toLowerCase() === k,
        );
        return key ? raw[key]!.trim() : "";
      };

      const nome = get("nome");
      if (!nome) {
        erros.push({ linha, motivo: "nome obrigatório", nivel: "erro" });
        continue;
      }

      const codigo = get("codigo") || null;
      if (codigo && porCodigo.has(codigo.toLowerCase())) {
        reutilizadas++;
        continue;
      }

      const preco = parseValorCsv(get("preco_base")) ?? 0;
      novas.push({
        codigo,
        nome,
        descricao: get("descricao") || null,
        linha: get("linha") || null,
        unidade: get("unidade") || "un",
        preco_base: preco,
      });
      if (codigo) porCodigo.set(codigo.toLowerCase(), "pending");
    }

    if (novas.length > 0) {
      const { data, error } = await supabase
        .from("produtos")
        .insert(novas)
        .select("id");
      if (error) throw new Error(error.message);
      for (const row of data ?? []) criadas.push(row.id);
      importadas = criadas.length;
    }
  } catch (e) {
    if (criadas.length) {
      await supabase.from("produtos").delete().in("id", criadas);
    }
    throw e;
  }

  return { importadas, reutilizadas, erros };
}
