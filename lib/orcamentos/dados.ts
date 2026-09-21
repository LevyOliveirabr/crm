import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { montarLinksProposta, type LinkProposta } from "@/lib/orcamentos/itens";

type Client = SupabaseClient<Database>;

export type ItemOrcamento = {
  id: string;
  ordem: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  descontoPct: number;
  total: number;
  /** Produto do catálogo (null = item livre), com links para a proposta. */
  produto: {
    id: string;
    nome: string;
    codigo: string | null;
    link: string | null;
    catalogoUrl: string | null;
    categoria: { nome: string; catalogoUrl: string | null } | null;
  } | null;
};

export type OrcamentoCompleto = {
  id: string;
  numero: string | null;
  titulo: string | null;
  origem: string;
  situacao: Database["public"]["Enums"]["situacao_orcamento"];
  valor: number;
  subtotal: number | null;
  descontoGeralPct: number;
  enviadoEm: string;
  validade: string | null;
  condicoesPagamento: string | null;
  prazoEntrega: string | null;
  frete: string | null;
  observacoes: string | null;
  arquivoPath: string | null;
  arquivoUrl: string | null;
  aceitoEm: string | null;
  aceitoPor: string | null;
  itens: ItemOrcamento[];
  negociacao: {
    id: string;
    titulo: string;
    responsavelNome: string;
    responsavelEmail: string | null;
    responsavelCargo: string | null;
    responsavelTelefone: string | null;
    responsavelWhatsapp: string | null;
    responsavelLinkedin: string | null;
    status: string;
  };
  empresa: {
    id: string;
    nome: string;
    cnpj: string | null;
    cidade: string | null;
    uf: string | null;
  };
  contato: { nome: string; email: string | null; whatsapp: string | null } | null;
  emitente: {
    id: string | null;
    nome: string;
    razaoSocial: string;
    cnpj: string | null;
    endereco: string | null;
    telefone: string | null;
    email: string | null;
    site: string | null;
    logoUrl: string | null;
    rodape: string | null;
  } | null;
  /** Materiais e links (site, catálogos, páginas de produto), deduplicados. */
  links: LinkProposta[];
  /** true quando a negociação está aberta e o orçamento é gerado e ainda "enviado". */
  editavel: boolean;
};

type EmitenteDoc = {
  id: string | null;
  nome: string;
  razao_social: string;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  logo_path: string | null;
  rodape: string | null;
};

/**
 * Emitente (empresa vendedora) da negociação. Se a migration 0008 ainda não
 * estiver aplicada, cai para a tabela antiga `emitente` (linha única).
 */
async function carregarEmitente(
  supabase: Client,
  emitenteId: string | null,
): Promise<EmitenteDoc | null> {
  if (emitenteId) {
    const { data, error } = await supabase
      .from("emitentes")
      .select("id, nome, razao_social, cnpj, endereco, telefone, email, site, logo_path, rodape")
      .eq("id", emitenteId)
      .maybeSingle();
    if (!error && data) return data;
  }
  const { data: legado } = await supabase
    .from("emitente")
    .select("razao_social, cnpj, endereco, telefone, email, site, logo_path, rodape")
    .eq("id", 1)
    .maybeSingle();
  if (!legado) return null;
  return { id: null, nome: legado.razao_social, ...legado };
}

/**
 * Carrega o orçamento com itens, negociação, empresa e emitente (empresa vendedora).
 * Funciona com o client do usuário (RLS) ou com o admin (página pública).
 */
export async function carregarOrcamentoCompleto(
  supabase: Client,
  orcamentoId: string,
): Promise<OrcamentoCompleto | null> {
  const { data: o, error } = await supabase
    .from("orcamentos")
    .select(
      `id, numero, titulo, origem, situacao, valor, subtotal, desconto_geral_pct, enviado_em, validade,
       condicoes_pagamento, prazo_entrega, frete, observacoes, arquivo_path, aceito_em, aceito_por,
       negociacoes!inner ( id, titulo, status, arquivado_em, contato_id, empresa_id, emitente_id,
         empresas ( id, nome, cnpj, cidade, uf ),
         usuarios:responsavel_id ( nome, email, cargo, telefone, whatsapp, linkedin ),
         contatos:contato_id ( nome, email, whatsapp ) )`,
    )
    .eq("id", orcamentoId)
    .maybeSingle();

  if (error || !o) return null;

  type NegJoin = {
    id: string;
    titulo: string;
    status: string;
    arquivado_em: string | null;
    emitente_id: string | null;
    empresas: { id: string; nome: string; cnpj: string | null; cidade: string | null; uf: string | null } | null;
    usuarios: {
      nome: string;
      email: string | null;
      cargo: string | null;
      telefone: string | null;
      whatsapp: string | null;
      linkedin: string | null;
    } | null;
    contatos: { nome: string; email: string | null; whatsapp: string | null } | null;
  };
  const negRaw = o.negociacoes as unknown as NegJoin | NegJoin[] | null;
  const neg = Array.isArray(negRaw) ? negRaw[0] : negRaw;
  if (!neg) return null;
  const emp = Array.isArray(neg.empresas) ? neg.empresas[0] : neg.empresas;
  const resp = Array.isArray(neg.usuarios) ? neg.usuarios[0] : neg.usuarios;
  const cont = Array.isArray(neg.contatos) ? neg.contatos[0] : neg.contatos;

  const [{ data: itens }, emitente] = await Promise.all([
    supabase
      .from("orcamento_itens")
      .select(
        "id, ordem, descricao, unidade, quantidade, preco_unitario, desconto_pct, total, produtos ( id, nome, codigo, link, catalogo_url, catalogo_path, categorias_produto ( nome, catalogo_url, catalogo_path ) )",
      )
      .eq("orcamento_id", o.id)
      .order("ordem"),
    carregarEmitente(supabase, neg.emitente_id),
  ]);

  const publica = (path: string | null | undefined) =>
    path ? supabase.storage.from("publico").getPublicUrl(path).data.publicUrl : null;
  type CatJoin = { nome: string; catalogo_url: string | null; catalogo_path: string | null };
  type ProdJoin = {
    id: string;
    nome: string;
    codigo: string | null;
    link: string | null;
    catalogo_url: string | null;
    catalogo_path: string | null;
    categorias_produto: CatJoin | CatJoin[] | null;
  };
  const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  const itensMapeados: ItemOrcamento[] = (itens ?? []).map((i) => {
    const p = um((i as unknown as { produtos: ProdJoin | ProdJoin[] | null }).produtos);
    const cat = p ? um(p.categorias_produto) : null;
    return {
      id: i.id,
      ordem: i.ordem,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.preco_unitario),
      descontoPct: Number(i.desconto_pct),
      total: Number(i.total),
      produto: p
        ? {
            id: p.id,
            nome: p.nome,
            codigo: p.codigo,
            link: p.link,
            catalogoUrl: p.catalogo_url ?? publica(p.catalogo_path),
            categoria: cat ? { nome: cat.nome, catalogoUrl: cat.catalogo_url ?? publica(cat.catalogo_path) } : null,
          }
        : null,
    };
  });

  let arquivoUrl: string | null = null;
  if (o.arquivo_path) {
    const { data: signed } = await supabase.storage
      .from("orcamentos")
      .createSignedUrl(o.arquivo_path, 60 * 60);
    arquivoUrl = signed?.signedUrl ?? null;
  }

  let logoUrl: string | null = null;
  if (emitente?.logo_path) {
    const { data: pub } = supabase.storage.from("publico").getPublicUrl(emitente.logo_path);
    logoUrl = pub?.publicUrl ?? null;
  }

  return {
    id: o.id,
    numero: o.numero,
    titulo: o.titulo,
    origem: o.origem,
    situacao: o.situacao,
    valor: Number(o.valor ?? 0),
    subtotal: o.subtotal != null ? Number(o.subtotal) : null,
    descontoGeralPct: Number(o.desconto_geral_pct ?? 0),
    enviadoEm: o.enviado_em,
    validade: o.validade,
    condicoesPagamento: o.condicoes_pagamento,
    prazoEntrega: o.prazo_entrega,
    frete: o.frete,
    observacoes: o.observacoes,
    arquivoPath: o.arquivo_path,
    arquivoUrl,
    aceitoEm: o.aceito_em,
    aceitoPor: o.aceito_por,
    itens: itensMapeados,
    links: montarLinksProposta(
      emitente ? { nome: emitente.nome, site: emitente.site } : null,
      itensMapeados,
    ),
    editavel:
      o.origem === "gerado" &&
      o.situacao === "enviado" &&
      !o.aceito_em &&
      neg.status === "aberta" &&
      !neg.arquivado_em,
    negociacao: {
      id: neg.id,
      titulo: neg.titulo,
      responsavelNome: resp?.nome ?? "—",
      responsavelEmail: resp?.email ?? null,
      responsavelCargo: resp?.cargo ?? null,
      responsavelTelefone: resp?.telefone ?? null,
      responsavelWhatsapp: resp?.whatsapp ?? null,
      responsavelLinkedin: resp?.linkedin ?? null,
      status: neg.status,
    },
    empresa: {
      id: emp?.id ?? "",
      nome: emp?.nome ?? "—",
      cnpj: emp?.cnpj ?? null,
      cidade: emp?.cidade ?? null,
      uf: emp?.uf ?? null,
    },
    contato: cont ? { nome: cont.nome, email: cont.email, whatsapp: cont.whatsapp } : null,
    emitente: emitente
      ? {
          id: emitente.id,
          nome: emitente.nome,
          razaoSocial: emitente.razao_social,
          cnpj: emitente.cnpj,
          endereco: emitente.endereco,
          telefone: emitente.telefone,
          email: emitente.email,
          site: emitente.site,
          logoUrl,
          rodape: emitente.rodape,
        }
      : null,
  };
}
