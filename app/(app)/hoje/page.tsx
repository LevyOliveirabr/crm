import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  formatarMoeda,
  formatarData,
  hojeISO,
  inicioMesAtualISO,
  inicioProximoMesISO,
  adicionarDiasISO,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  HojeInterativo,
  type AcaoHojeItem,
  type NegociacaoSemAcaoItem,
} from "@/components/crm/hoje-interativo";
import { SeletorVendedor } from "@/components/crm/seletor-vendedor";

type SearchParams = Promise<{ vendedor?: string | string[] }>;

function paramUnico(
  valor: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function HojePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const vendedorParam = paramUnico(sp.vendedor);
  const filtrarVendedor =
    usuario.perfil === "diretor" && vendedorParam
      ? vendedorParam
      : null;

  const supabase = await createClient();
  const hoje = hojeISO();
  const inicioMes = inicioMesAtualISO();
  const fimMes = inicioProximoMesISO(hoje);

  const [{ data: configRow }, { data: vendedores }] = await Promise.all([
    supabase
      .from("config")
      .select("valor")
      .eq("chave", "alerta_validade_orcamento_dias")
      .maybeSingle(),
    usuario.perfil === "diretor"
      ? supabase
          .from("usuarios")
          .select("id, nome")
          .eq("ativo", true)
          .order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);

  const alertaDias = Math.max(
    1,
    Number.parseInt(configRow?.valor ?? "3", 10) || 3,
  );
  const validadeLimite = adicionarDiasISO(hoje, alertaDias);

  // --- Números (aberto / vendido / perdido) ---
  let abertoQuery = supabase
    .from("v_negociacoes")
    .select("valor_estimado")
    .eq("status", "aberta");
  if (filtrarVendedor) {
    abertoQuery = abertoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: abertas } = await abertoQuery;

  const aberto = (abertas ?? []).reduce(
    (acc, row) => acc + Number(row.valor_estimado ?? 0),
    0,
  );

  let vendidoQuery = supabase
    .from("negociacoes")
    .select("valor_final")
    .eq("status", "vendida")
    .is("arquivado_em", null)
    .gte("fechado_em", `${inicioMes}T00:00:00-03:00`)
    .lt("fechado_em", `${fimMes}T00:00:00-03:00`);
  if (filtrarVendedor) {
    vendidoQuery = vendidoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: vendas } = await vendidoQuery;
  const vendido = (vendas ?? []).reduce(
    (acc, row) => acc + Number(row.valor_final ?? 0),
    0,
  );

  let perdidoQuery = supabase
    .from("negociacoes")
    .select("valor_estimado")
    .eq("status", "perdida")
    .is("arquivado_em", null)
    .gte("fechado_em", `${inicioMes}T00:00:00-03:00`)
    .lt("fechado_em", `${fimMes}T00:00:00-03:00`);
  if (filtrarVendedor) {
    perdidoQuery = perdidoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: perdas } = await perdidoQuery;
  const perdido = (perdas ?? []).reduce(
    (acc, row) => acc + Number(row.valor_estimado ?? 0),
    0,
  );

  // --- Ações pendentes (atrasadas + hoje) ---
  let acoesQuery = supabase
    .from("acoes")
    .select(
      `
      id,
      descricao,
      tipo,
      data,
      negociacao_id,
      negociacoes!inner (
        id,
        status,
        arquivado_em,
        responsavel_id,
        empresas ( nome )
      )
    `,
    )
    .is("concluida_em", null)
    .lte("data", hoje)
    .eq("negociacoes.status", "aberta")
    .is("negociacoes.arquivado_em", null)
    .order("data", { ascending: true });

  if (filtrarVendedor) {
    acoesQuery = acoesQuery.eq("negociacoes.responsavel_id", filtrarVendedor);
  }

  const { data: acoesRaw } = await acoesQuery;

  type AcaoJoin = {
    id: string;
    descricao: string;
    tipo: AcaoHojeItem["tipo"];
    data: string;
    negociacao_id: string;
    negociacoes:
      | {
          id: string;
          status: string;
          arquivado_em: string | null;
          responsavel_id: string;
          empresas: { nome: string } | { nome: string }[] | null;
        }
      | {
          id: string;
          status: string;
          arquivado_em: string | null;
          responsavel_id: string;
          empresas: { nome: string } | { nome: string }[] | null;
        }[]
      | null;
  };

  function empresaDe(join: AcaoJoin["negociacoes"]): string {
    const neg = Array.isArray(join) ? join[0] : join;
    if (!neg) return "—";
    const emp = neg.empresas;
    if (!emp) return "—";
    if (Array.isArray(emp)) return emp[0]?.nome ?? "—";
    return emp.nome ?? "—";
  }

  const acoes: AcaoHojeItem[] = ((acoesRaw ?? []) as unknown as AcaoJoin[]).map(
    (a) => ({
      id: a.id,
      descricao: a.descricao,
      tipo: a.tipo,
      data: a.data,
      negociacaoId: a.negociacao_id,
      empresaNome: empresaDe(a.negociacoes),
      atrasada: a.data < hoje,
    }),
  );

  const atrasadas = acoes.filter((a) => a.atrasada);
  const deHoje = acoes.filter((a) => !a.atrasada);

  // --- Negociações sem ação ---
  let semAcaoQuery = supabase
    .from("v_negociacoes")
    .select("id, titulo, empresa_nome")
    .eq("status", "aberta")
    .eq("sem_acao", true)
    .order("atualizado_em", { ascending: false });
  if (filtrarVendedor) {
    semAcaoQuery = semAcaoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: semAcaoRaw } = await semAcaoQuery;
  const semAcao: NegociacaoSemAcaoItem[] = (semAcaoRaw ?? []).map((n) => ({
    id: n.id!,
    titulo: n.titulo ?? "Sem título",
    empresaNome: n.empresa_nome ?? "—",
  }));

  // --- Orçamentos vencendo ---
  let orcQuery = supabase
    .from("orcamentos")
    .select(
      `
      id,
      numero,
      valor,
      validade,
      negociacao_id,
      negociacoes!inner (
        id,
        titulo,
        status,
        arquivado_em,
        responsavel_id,
        empresas ( nome )
      )
    `,
    )
    .eq("situacao", "enviado")
    .not("validade", "is", null)
    .gte("validade", hoje)
    .lte("validade", validadeLimite)
    .eq("negociacoes.status", "aberta")
    .is("negociacoes.arquivado_em", null)
    .order("validade", { ascending: true });

  if (filtrarVendedor) {
    orcQuery = orcQuery.eq("negociacoes.responsavel_id", filtrarVendedor);
  }

  const { data: orcRaw } = await orcQuery;

  type NegJoin = {
    id: string;
    titulo?: string | null;
    status: string;
    arquivado_em: string | null;
    responsavel_id: string;
    empresas: { nome: string } | { nome: string }[] | null;
  };

  type OrcJoin = {
    id: string;
    numero: string | null;
    valor: number;
    validade: string | null;
    negociacao_id: string;
    negociacoes: NegJoin | NegJoin[] | null;
  };

  function tituloNeg(join: OrcJoin["negociacoes"]): string {
    const neg = Array.isArray(join) ? join[0] : join;
    return neg?.titulo ?? "Negociação";
  }

  const orcamentos = ((orcRaw ?? []) as unknown as OrcJoin[]).map((o) => ({
    id: o.id,
    numero: o.numero,
    valor: Number(o.valor ?? 0),
    validade: o.validade,
    negociacaoId: o.negociacao_id,
    empresaNome: empresaDe(o.negociacoes),
    titulo: tituloNeg(o.negociacoes),
  }));

  return (
    <div className="relative mx-auto w-full max-w-2xl pb-20">
      <header className="mb-4 flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Hoje</h1>
        {usuario.perfil === "diretor" ? (
          <Suspense fallback={null}>
            <SeletorVendedor
              vendedores={vendedores ?? []}
              valor={filtrarVendedor}
            />
          </Suspense>
        ) : null}
      </header>

      <section
        aria-label="Resumo do mês"
        className="grid grid-cols-3 gap-2 sm:gap-3"
      >
        <NumeroResumo label="Aberto" valor={aberto} />
        <NumeroResumo label="Vendido no mês" valor={vendido} destaque="ok" />
        <NumeroResumo
          label="Perdido no mês"
          valor={perdido}
          destaque="ruim"
        />
      </section>

      <HojeInterativo
        atrasadas={atrasadas}
        deHoje={deHoje}
        semAcao={semAcao}
      />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold tracking-tight text-foreground">
          Orçamentos vencendo
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({alertaDias}d)
          </span>
        </h2>
        {orcamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum orçamento vencendo.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {orcamentos.map((o) => (
              <li key={o.id} className="px-3 py-2.5">
                <Link
                  href={`/orcamentos/${o.id}`}
                  className="block text-sm font-medium hover:underline"
                >
                  {o.numero ? `Orçamento ${o.numero}` : o.titulo}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {o.empresaNome}
                  <span className="mx-1 opacity-50">·</span>
                  {formatarMoeda(o.valor)}
                  <span className="mx-1 opacity-50">·</span>
                  validade {o.validade ? formatarData(o.validade) : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/negociacoes/nova"
        className="fixed right-4 bottom-20 z-30 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 lg:right-8 lg:bottom-8"
        aria-label="Nova negociação"
      >
        <Plus className="size-6" />
        <span className="sr-only">+ Negociação</span>
      </Link>
    </div>
  );
}

function NumeroResumo({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: number;
  destaque?: "ok" | "ruim";
}) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-3 sm:px-3">
      <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p
        className={
          destaque === "ok"
            ? "mt-1 text-sm font-semibold tabular-nums text-emerald-700 sm:text-base"
            : destaque === "ruim"
              ? "mt-1 text-sm font-semibold tabular-nums text-destructive sm:text-base"
              : "mt-1 text-sm font-semibold tabular-nums sm:text-base"
        }
      >
        {formatarMoeda(valor)}
      </p>
    </div>
  );
}
