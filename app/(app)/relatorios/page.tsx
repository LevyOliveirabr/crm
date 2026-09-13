import { Suspense } from "react";

import { FiltroMes } from "@/components/crm/filtro-mes";
import { RelatoriosClient } from "@/components/crm/relatorios-client";
import { SeletorVendedor } from "@/components/crm/seletor-vendedor";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { inicioMesAtualISO, inicioMesISO } from "@/lib/format";
import {
  parseRelatorioPresidencia,
  type FunilEtapaBarra,
} from "@/lib/relatorio-presidencia";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  mes?: string | string[];
  vendedor?: string | string[];
}>;

function paramUnico(
  valor: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const mesParam = paramUnico(sp.mes);
  const mesISO = inicioMesISO(mesParam ?? inicioMesAtualISO());
  const mesChave = mesISO.slice(0, 7);

  const vendedorParam = paramUnico(sp.vendedor);
  const filtrarVendedor =
    usuario.perfil === "diretor" && vendedorParam
      ? vendedorParam
      : null;

  const supabase = await createClient();

  const [{ data: rpcData }, { data: comentarioRow }, { data: vendedores }, funilBarras] =
    await Promise.all([
      supabase.rpc("relatorio_presidencia", { p_mes: mesISO }),
      supabase
        .from("config")
        .select("valor")
        .eq("chave", `comentario_${mesChave}`)
        .maybeSingle(),
      usuario.perfil === "diretor"
        ? supabase
            .from("usuarios")
            .select("id, nome")
            .eq("ativo", true)
            .order("nome")
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      carregarFunilBarras(filtrarVendedor),
    ]);

  const relatorio = parseRelatorioPresidencia(rpcData);

  return (
    <div className="relative mx-auto w-full max-w-3xl pb-16">
      <header className="no-print mb-4 flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Relatórios</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <Suspense fallback={null}>
            <FiltroMes valor={mesChave} />
          </Suspense>
          {usuario.perfil === "diretor" ? (
            <Suspense fallback={null}>
              <SeletorVendedor
                vendedores={vendedores ?? []}
                valor={filtrarVendedor}
              />
            </Suspense>
          ) : null}
        </div>
      </header>

      <RelatoriosClient
        relatorio={relatorio}
        comentarioInicial={comentarioRow?.valor ?? ""}
        mesChave={mesChave}
        ehDiretor={usuario.perfil === "diretor"}
        funilBarras={funilBarras}
      />
    </div>
  );
}

async function carregarFunilBarras(
  filtrarVendedor: string | null,
): Promise<FunilEtapaBarra[]> {
  const supabase = await createClient();

  if (!filtrarVendedor) {
    const { data } = await supabase
      .from("v_funil")
      .select("funil_id, funil, etapa_id, etapa, ordem, qtd, valor")
      .order("ordem", { ascending: true });

    return (data ?? [])
      .filter((r) => r.funil_id && r.etapa_id)
      .map((r) => ({
        funilId: r.funil_id!,
        funil: r.funil ?? "Funil",
        etapaId: r.etapa_id!,
        etapa: r.etapa ?? "Etapa",
        ordem: Number(r.ordem ?? 0),
        qtd: Number(r.qtd ?? 0),
        valor: Number(r.valor ?? 0),
      }));
  }

  // v_funil não tem responsavel_id — agrega a partir das negociações do vendedor
  const [{ data: etapas }, { data: negociacoes }] = await Promise.all([
    supabase
      .from("etapas")
      .select("id, nome, ordem, funil_id, funis!inner(id, nome, ativo)")
      .eq("ativo", true)
      .eq("funis.ativo", true)
      .order("ordem", { ascending: true }),
    supabase
      .from("negociacoes")
      .select("etapa_id, valor_estimado")
      .eq("status", "aberta")
      .is("arquivado_em", null)
      .eq("responsavel_id", filtrarVendedor),
  ]);

  type EtapaJoin = {
    id: string;
    nome: string;
    ordem: number;
    funil_id: string;
    funis:
      | { id: string; nome: string; ativo: boolean }
      | { id: string; nome: string; ativo: boolean }[]
      | null;
  };

  const agg = new Map<string, { qtd: number; valor: number }>();
  for (const n of negociacoes ?? []) {
    if (!n.etapa_id) continue;
    const cur = agg.get(n.etapa_id) ?? { qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += Number(n.valor_estimado ?? 0);
    agg.set(n.etapa_id, cur);
  }

  return ((etapas ?? []) as unknown as EtapaJoin[]).map((et) => {
    const funil = Array.isArray(et.funis) ? et.funis[0] : et.funis;
    const nums = agg.get(et.id) ?? { qtd: 0, valor: 0 };
    return {
      funilId: funil?.id ?? et.funil_id,
      funil: funil?.nome ?? "Funil",
      etapaId: et.id,
      etapa: et.nome,
      ordem: et.ordem,
      qtd: nums.qtd,
      valor: nums.valor,
    };
  });
}
