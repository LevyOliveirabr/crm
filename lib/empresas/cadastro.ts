import { normalizarNome } from "@/lib/format";

/** Campos que o MCP grava na ficha da empresa. `cidade` espelha `municipio`. */
export const CAMPOS_EMPRESA_MCP = [
  "nome",
  "razao_social",
  "nome_fantasia",
  "cnpj",
  "inscricao_estadual",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cep",
  "cidade",
  "uf",
  "telefone",
  "email",
  "site",
  "atividade_principal",
  "observacoes",
  "segmento",
] as const;

export type CampoEmpresaMcp = (typeof CAMPOS_EMPRESA_MCP)[number];

export const ROTULO_CAMPO_EMPRESA: Record<CampoEmpresaMcp, string> = {
  nome: "nome",
  razao_social: "razão social",
  nome_fantasia: "nome fantasia",
  cnpj: "CNPJ",
  inscricao_estadual: "inscrição estadual",
  logradouro: "logradouro",
  numero: "número",
  complemento: "complemento",
  bairro: "bairro",
  cep: "CEP",
  cidade: "cidade",
  uf: "UF",
  telefone: "telefone",
  email: "e-mail",
  site: "site",
  atividade_principal: "atividade principal",
  observacoes: "observações",
  segmento: "segmento",
};

export const CAMPOS_CONTATO_MCP = [
  "nome",
  "cargo",
  "telefone",
  "whatsapp",
  "email",
  "principal",
] as const;

export type CampoContatoMcp = (typeof CAMPOS_CONTATO_MCP)[number];

export const ROTULO_CAMPO_CONTATO: Record<CampoContatoMcp, string> = {
  nome: "nome",
  cargo: "cargo",
  telefone: "telefone",
  whatsapp: "WhatsApp",
  email: "e-mail",
  principal: "principal",
};

export type EmpresaRef = { id: string; nome: string };

export type DecisaoEmpresaExistente =
  | { tipo: "criar" }
  | { tipo: "existente"; empresa: EmpresaRef; aviso: string }
  | { tipo: "conflito"; erro: string };

/** Nome e CNPJ apontando para a mesma ficha reutilizam; se divergirem, não grava. */
export function decidirEmpresaExistente(
  porNome: EmpresaRef | null,
  porCnpj: EmpresaRef | null,
): DecisaoEmpresaExistente {
  if (porNome && porCnpj && porNome.id !== porCnpj.id) {
    return {
      tipo: "conflito",
      erro:
        `O nome já é da empresa "${porNome.nome}" (id=${porNome.id}) e o CNPJ já é da empresa "${porCnpj.nome}" (id=${porCnpj.id}). Nada foi gravado.`,
    };
  }
  const hit = porCnpj ?? porNome;
  if (!hit) return { tipo: "criar" };
  const motivo =
    porNome && porCnpj ? "nome e CNPJ" : porCnpj ? "CNPJ" : "nome";
  return {
    tipo: "existente",
    empresa: hit,
    aviso: `Empresa já existia pelo ${motivo}: ${hit.nome}. id=${hit.id}. Nada foi duplicado nem alterado.`,
  };
}

export type FiltroBuscaEmpresa =
  | { modo: "cnpj"; digitos: string }
  | { modo: "nome"; nome: string }
  | { modo: "ambos"; nome: string; digitos: string };

/** Texto só de CNPJ (com ou sem máscara) busca pelos dígitos; o resto, pelo nome. */
export function filtroBuscaEmpresa(texto: string): FiltroBuscaEmpresa {
  const limpo = texto.trim();
  const digitos = limpo.replace(/\D/g, "");
  const nome = limpo.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
  const soCnpj = /^[\d.\-/\s]+$/.test(limpo) && digitos.length >= 8;
  if (soCnpj) return { modo: "cnpj", digitos };
  if (digitos.length >= 8 && nome.length > 0) {
    return { modo: "ambos", nome, digitos };
  }
  return { modo: "nome", nome };
}

export function colunasPresentes<K extends string>(
  input: Partial<Record<K, unknown>>,
  chaves: readonly K[],
): K[] {
  return chaves.filter((c) => input[c] !== undefined);
}

/** Junta rótulos para a frase da timeline: "CNPJ, cidade e e-mail". */
export function juntarRotulos(rotulos: string[]): string {
  if (rotulos.length === 0) return "";
  if (rotulos.length === 1) return rotulos[0]!;
  return `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}`;
}

type LinhaEmpresa = Partial<Record<CampoEmpresaMcp | "municipio", string | null>>;

/** Copia só as chaves enviadas. `cidade` também grava `municipio`. */
export function paraLinhaEmpresa(
  input: Partial<Record<CampoEmpresaMcp, string | null>>,
): LinhaEmpresa {
  const linha: LinhaEmpresa = {};
  for (const campo of CAMPOS_EMPRESA_MCP) {
    if (input[campo] !== undefined) linha[campo] = input[campo] ?? null;
  }
  if (input.cidade !== undefined) linha.municipio = input.cidade ?? null;
  return linha;
}

export function camposEmpresaAlterados(
  atual: Partial<Record<CampoEmpresaMcp | "municipio", string | null>>,
  linha: LinhaEmpresa,
): CampoEmpresaMcp[] {
  const mudou: CampoEmpresaMcp[] = [];
  for (const campo of CAMPOS_EMPRESA_MCP) {
    if (linha[campo] === undefined) continue;
    const antes = atual[campo] ?? null;
    const depois = linha[campo] ?? null;
    if (campo === "cidade") {
      const municipioAntes = atual.municipio ?? null;
      const municipioDepois = linha.municipio ?? null;
      if (antes !== depois || municipioAntes !== municipioDepois) mudou.push(campo);
      continue;
    }
    if (antes !== depois) mudou.push(campo);
  }
  return mudou;
}

export function camposContatoAlterados(
  atual: {
    nome: string;
    cargo: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
    principal: boolean;
  },
  patch: Partial<{
    nome: string | null;
    cargo: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
    principal: boolean;
  }>,
): CampoContatoMcp[] {
  const mudou: CampoContatoMcp[] = [];
  for (const campo of CAMPOS_CONTATO_MCP) {
    if (patch[campo] === undefined) continue;
    if (campo === "principal") {
      if (atual.principal !== patch.principal) mudou.push(campo);
      continue;
    }
    const antes = atual[campo] ?? null;
    const depois = patch[campo] ?? null;
    if (antes !== depois) mudou.push(campo);
  }
  return mudou;
}

export function acharPorNome<T extends { id: string; nome: string }>(
  itens: T[],
  nome: string,
): T | null {
  const alvo = normalizarNome(nome);
  return itens.find((item) => normalizarNome(item.nome) === alvo) ?? null;
}

/** "sim" / "não" (e boolean) viram o flag `principal`. */
export function principalDe(valor: boolean): "sim" | "nao" {
  return valor ? "sim" : "nao";
}
