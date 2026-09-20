"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  replicarMetaAno,
  salvarMeta,
  type MetasAno,
} from "@/lib/actions/metas";
import { formatarMoeda, parseMoedaBR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/toast";

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function chave(id: string, mes: number) {
  return `${id}|${mes}`;
}

export function MetasConfigClient({ dados }: { dados: MetasAno }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const m of dados.metas) {
      const mes = Number(m.mes.slice(5, 7));
      out[chave(m.responsavel_id, mes)] =
        m.valor > 0 ? formatarMoeda(m.valor) : "";
    }
    return out;
  });
  const [mesReplicar, setMesReplicar] = useState<number>(
    new Date().getMonth() + 1,
  );

  const totais = useMemo(() => {
    const porMes = Array.from({ length: 12 }, () => 0);
    for (const [k, v] of Object.entries(valores)) {
      const mes = Number(k.split("|")[1]);
      porMes[mes - 1] += parseMoedaBR(v) ?? 0;
    }
    return porMes;
  }, [valores]);

  function salvar(id: string, mes: number, texto: string) {
    const valor = parseMoedaBR(texto);
    if (valor == null || valor < 0) {
      toast.add({ title: "Valor inválido.", type: "error" });
      return;
    }
    const k = chave(id, mes);
    setValores((v) => ({ ...v, [k]: valor > 0 ? formatarMoeda(valor) : "" }));
    startTransition(async () => {
      const res = await salvarMeta({
        emitente_id: dados.emitenteId,
        responsavel_id: id,
        mes: `${dados.ano}-${String(mes).padStart(2, "0")}-01`,
        valor,
      });
      if (!res.ok) toast.add({ title: res.error, type: "error" });
    });
  }

  function mudarAno(delta: number) {
    router.push(
      `/configuracoes/metas?ano=${dados.ano + delta}&empresa=${dados.emitenteId}`,
    );
  }

  function mudarEmpresa(id: string) {
    router.push(`/configuracoes/metas?ano=${dados.ano}&empresa=${id}`);
  }

  return (
    <Toaster>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Empresa</span>
            <select
              value={dados.emitenteId}
              onChange={(e) => mudarEmpresa(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {dados.emitentes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => mudarAno(-1)}
              aria-label="Ano anterior"
            >
              ‹
            </Button>
            <span className="px-2 text-sm font-semibold tabular-nums">
              {dados.ano}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => mudarAno(1)}
              aria-label="Próximo ano"
            >
              ›
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="metas-replicar" className="text-muted-foreground">
              Copiar metas de
            </label>
            <select
              id="metas-replicar"
              value={mesReplicar}
              onChange={(e) => setMesReplicar(Number(e.target.value))}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || mesReplicar >= 12}
              onClick={() =>
                startTransition(async () => {
                  const res = await replicarMetaAno({
                    emitenteId: dados.emitenteId,
                    ano: dados.ano,
                    mesOrigem: mesReplicar,
                  });
                  if (!res.ok) {
                    toast.add({ title: res.error, type: "error" });
                    return;
                  }
                  toast.add({
                    title: `${res.copiadas} meta(s) copiada(s) para os meses seguintes.`,
                    type: "success",
                  });
                  router.refresh();
                })
              }
            >
              para os meses seguintes
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-input">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60">
                <th className="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-left font-semibold">
                  Vendedor
                </th>
                {MESES.map((m) => (
                  <th key={m} className="px-1.5 py-2 text-right font-semibold">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.vendedores.map((v) => (
                <tr key={v.id} className={!v.ativo ? "opacity-60" : undefined}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap">
                    {v.nome}
                    {v.perfil === "diretor" ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (diretor)
                      </span>
                    ) : null}
                  </td>
                  {MESES.map((_, i) => {
                    const mes = i + 1;
                    const k = chave(v.id, mes);
                    return (
                      <td key={k} className="px-1 py-1">
                        <input
                          aria-label={`Meta de ${v.nome} em ${MESES[i]}/${dados.ano}`}
                          inputMode="decimal"
                          value={valores[k] ?? ""}
                          placeholder="—"
                          onChange={(e) =>
                            setValores((s) => ({ ...s, [k]: e.target.value }))
                          }
                          onBlur={(e) => {
                            const original = dados.metas.find(
                              (m) =>
                                m.responsavel_id === v.id &&
                                Number(m.mes.slice(5, 7)) === mes,
                            );
                            const novo = parseMoedaBR(e.target.value) ?? 0;
                            if (
                              (original?.valor ?? 0) === novo &&
                              !e.target.value.trim() &&
                              !original
                            )
                              return;
                            if ((original?.valor ?? 0) === novo) {
                              setValores((s) => ({
                                ...s,
                                [k]: novo > 0 ? formatarMoeda(novo) : "",
                              }));
                              return;
                            }
                            salvar(v.id, mes, e.target.value);
                          }}
                          className="h-8 w-[7.5rem] rounded-md border border-input bg-transparent px-2 text-right text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {dados.vendedores.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-4 text-muted-foreground">
                    Nenhum usuário vinculado a esta empresa.
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-input bg-muted/40 font-semibold">
                <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2">
                  Total
                </td>
                {totais.map((t, i) => (
                  <td
                    key={i}
                    className="px-1.5 py-2 text-right text-xs tabular-nums whitespace-nowrap"
                  >
                    {t > 0 ? formatarMoeda(t) : "—"}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Valores em R$ de vendas fechadas (valor final) no mês. O atingimento
          aparece no dashboard e no ranking.
        </p>
      </div>
    </Toaster>
  );
}
