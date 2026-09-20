import { notFound } from "next/navigation";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { ehDiretorDe } from "@/lib/auth/permissoes";
import { createClient } from "@/lib/supabase/server";
import {
  NegociacaoFicha,
  type AcaoFicha,
  type ContatoFicha,
  type InteracaoFicha,
  type OrcamentoFicha,
} from "@/components/crm/negociacao-ficha";

type Params = Promise<{ id: string }>;

export default async function NegociacaoPage({
  params,
}: {
  params: Params;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: neg, error } = await supabase
    .from("negociacoes")
    .select(
      `
      id,
      titulo,
      empresa_id,
      valor_estimado,
      temperatura,
      responsavel_id,
      linha,
      origem,
      previsao_mes,
      status,
      valor_final,
      motivo_perda,
      anotacao_fechamento,
      fechado_em,
      etapa_id,
      funil_id,
      contato_id,
      arquivado_em,
      atualizado_em,
      emitente_id,
      emitentes ( id, nome ),
      empresas ( id, nome ),
      usuarios:responsavel_id ( id, nome )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !neg || neg.arquivado_em) {
    notFound();
  }

  const empresa = Array.isArray(neg.empresas)
    ? neg.empresas[0]
    : neg.empresas;
  const responsavel = Array.isArray(neg.usuarios)
    ? neg.usuarios[0]
    : neg.usuarios;

  // Coluna criada na migration 0006; lida separadamente para a ficha
  // continuar abrindo em bancos onde a migration ainda não foi aplicada.
  const { data: faturamentoRow } = await supabase
    .from("negociacoes")
    .select("data_faturamento, previsao_data, categoria_forecast")
    .eq("id", id)
    .maybeSingle();

  const [
    { data: etapas },
    { data: acoes },
    { data: interacoesRaw },
    { data: orcamentosRaw },
    { data: contatosRaw },
    { data: listas },
    { data: membrosRaw },
  ] = await Promise.all([
    supabase
      .from("etapas")
      .select("id, nome, ordem")
      .eq("funil_id", neg.funil_id)
      .eq("ativo", true)
      .order("ordem"),
    supabase
      .from("acoes")
      .select("id, descricao, tipo, data, concluida_em, criado_em")
      .eq("negociacao_id", neg.id)
      .order("data", { ascending: true }),
    supabase
      .from("interacoes")
      .select("id, tipo, texto, criado_em, usuarios:usuario_id ( nome )")
      .eq("negociacao_id", neg.id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("orcamentos")
      .select(
        "id, numero, valor, enviado_em, validade, situacao, origem, criado_em, arquivo_path, aceito_em",
      )
      .eq("negociacao_id", neg.id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("contatos")
      .select("id, nome, whatsapp, cargo")
      .eq("empresa_id", neg.empresa_id)
      .is("arquivado_em", null)
      .order("nome"),
    supabase
      .from("listas")
      .select("tipo, valor, ordem")
      .eq("ativo", true)
      .in("tipo", ["linha", "origem", "motivo_perda"])
      .order("ordem"),
    ehDiretorDe(usuario, neg.emitente_id)
      ? supabase
          .from("usuario_emitentes")
          .select("usuario_id, usuarios:usuario_id ( id, nome, ativo )")
          .eq("emitente_id", neg.emitente_id)
      : Promise.resolve({ data: null }),
  ]);

  type MembroJoin = {
    usuario_id: string;
    usuarios: { id: string; nome: string; ativo: boolean } | { id: string; nome: string; ativo: boolean }[] | null;
  };
  const vendedores = ((membrosRaw ?? []) as unknown as MembroJoin[])
    .map((m) => (Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios))
    .filter((u): u is { id: string; nome: string; ativo: boolean } => Boolean(u && u.ativo))
    .map((u) => ({ id: u.id, nome: u.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));


  const acoesList: AcaoFicha[] = (acoes ?? []).map((a) => ({
    id: a.id,
    descricao: a.descricao,
    tipo: a.tipo,
    data: a.data,
    concluidaEm: a.concluida_em,
    criadoEm: a.criado_em,
  }));

  const proximaAcao =
    acoesList.find((a) => a.concluidaEm == null) ?? null;
  const acoesConcluidas = acoesList.filter((a) => a.concluidaEm != null);

  const interacoes: InteracaoFicha[] = (interacoesRaw ?? []).map((i) => {
    const u = Array.isArray(i.usuarios) ? i.usuarios[0] : i.usuarios;
    return {
      id: i.id,
      tipo: i.tipo,
      texto: i.texto,
      criadoEm: i.criado_em,
      usuarioNome: u?.nome ?? null,
    };
  });

  const orcamentos: OrcamentoFicha[] = (orcamentosRaw ?? []).map((o) => ({
    id: o.id,
    numero: o.numero,
    valor: Number(o.valor),
    enviadoEm: o.enviado_em,
    validade: o.validade,
    situacao: o.situacao,
    origem: o.origem,
    criadoEm: o.criado_em,
    arquivoPath: o.arquivo_path,
    aceitoEm: o.aceito_em ?? null,
  }));

  const contatos: ContatoFicha[] = (contatosRaw ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    whatsapp: c.whatsapp,
    cargo: c.cargo,
  }));

  const linhas: string[] = [];
  const origens: string[] = [];
  const motivosPerda: string[] = [];
  for (const item of listas ?? []) {
    if (item.tipo === "linha") linhas.push(item.valor);
    else if (item.tipo === "origem") origens.push(item.valor);
    else if (item.tipo === "motivo_perda") motivosPerda.push(item.valor);
  }

  return (
    <NegociacaoFicha
      key={`${neg.id}-${neg.atualizado_em}-${neg.status}-${neg.etapa_id}`}
      negociacao={{
        id: neg.id,
        titulo: neg.titulo,
        empresaId: neg.empresa_id,
        empresaNome: empresa?.nome ?? "Empresa",
        emitenteId: neg.emitente_id ?? null,
        emitenteNome: (Array.isArray(neg.emitentes) ? neg.emitentes[0]?.nome : neg.emitentes?.nome) ?? null,
        valorEstimado: Number(neg.valor_estimado),
        temperatura: neg.temperatura,
        responsavelId: neg.responsavel_id,
        responsavelNome: responsavel?.nome ?? "—",
        linha: neg.linha,
        origem: neg.origem,
        previsaoMes: neg.previsao_mes,
        dataFaturamento: faturamentoRow?.data_faturamento ?? null,
        previsaoData: faturamentoRow?.previsao_data ?? null,
        categoriaForecast: faturamentoRow?.categoria_forecast ?? null,
        status: neg.status,
        valorFinal: neg.valor_final != null ? Number(neg.valor_final) : null,
        motivoPerda: neg.motivo_perda,
        anotacaoFechamento: neg.anotacao_fechamento,
        fechadoEm: neg.fechado_em,
        etapaId: neg.etapa_id,
        funilId: neg.funil_id,
        contatoId: neg.contato_id,
      }}
      etapas={(etapas ?? []).map((e) => ({
        id: e.id,
        nome: e.nome,
        ordem: e.ordem,
      }))}
      proximaAcao={proximaAcao}
      acoesConcluidas={acoesConcluidas}
      interacoes={interacoes}
      orcamentos={orcamentos}
      contatos={contatos}
      linhas={linhas}
      origens={origens}
      motivosPerda={motivosPerda}
      vendedores={vendedores}
      isDiretor={ehDiretorDe(usuario, neg.emitente_id)}
    />
  );
}
