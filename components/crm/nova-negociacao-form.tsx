"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, ChevronDown, Plus } from "lucide-react";

import {
  buscarEmpresas,
  criarEmpresa,
  type EmpresaResumo,
} from "@/lib/actions/empresas";
import {
  listarContatosEmpresa,
  type ContatoResumo,
} from "@/lib/actions/contatos";
import { criarNegociacao } from "@/lib/actions/negociacoes";
import type { DadosFormNegociacao } from "@/lib/actions/form-negociacao";
import {
  adicionarDiasISO,
  hojeISO,
  inicioProximoMesISO,
  parseMoedaBR,
  proximaSegundaISO,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  dados: DadosFormNegociacao;
  /** Empresa pré-selecionada (ex.: a partir da ficha da empresa). */
  empresaInicial?: EmpresaResumo | null;
  onCancelar?: () => void;
  className?: string;
};

export function NovaNegociacaoForm({
  dados,
  empresaInicial = null,
  onCancelar,
  className,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const funilDefault = dados.funis[0]?.id ?? "";

  const [empresa, setEmpresa] = useState<EmpresaResumo | null>(
    empresaInicial,
  );
  const [buscaEmpresa, setBuscaEmpresa] = useState(
    empresaInicial?.nome ?? "",
  );
  const [sugestoes, setSugestoes] = useState<EmpresaResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [novaEmpresaAberta, setNovaEmpresaAberta] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState({
    nome: "",
    cidade: "",
    segmento: "",
  });

  const [valorTexto, setValorTexto] = useState("");
  const [funilId, setFunilId] = useState(funilDefault);
  const [linha, setLinha] = useState("");
  const [acaoDesc, setAcaoDesc] = useState("");
  const [acaoData, setAcaoData] = useState(() =>
    adicionarDiasISO(hojeISO(), 1),
  );
  const [pularAcao, setPularAcao] = useState(false);

  const [maisAberto, setMaisAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [tituloManual, setTituloManual] = useState(false);
  const [origem, setOrigem] = useState("");
  const [temperatura, setTemperatura] = useState(2);
  const [previsaoMes, setPrevisaoMes] = useState(() =>
    inicioProximoMesISO().slice(0, 7),
  );
  const [contatoId, setContatoId] = useState<string>("");
  const [contatos, setContatos] = useState<ContatoResumo[]>([]);

  const tituloSugerido = useMemo(() => {
    if (!empresa) return "";
    return linha ? `[${linha}] ${empresa.nome}` : empresa.nome;
  }, [empresa, linha]);

  const tituloExibido = tituloManual ? titulo : tituloSugerido;
  const contatosVisiveis = empresa ? contatos : [];

  useEffect(() => {
    if (!empresa) return;
    let cancelado = false;
    void listarContatosEmpresa(empresa.id).then((res) => {
      if (cancelado || !res.ok) return;
      setContatos(res.contatos);
    });
    return () => {
      cancelado = true;
    };
  }, [empresa]);

  useEffect(() => {
    if (empresa || buscaEmpresa.trim().length < 2) {
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      setBuscando(true);
      const res = await buscarEmpresas(buscaEmpresa);
      if (cancelado) return;
      setBuscando(false);
      if (res.ok) setSugestoes(res.empresas);
    }, 220);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [buscaEmpresa, empresa]);

  const sugestoesVisiveis =
    empresa || buscaEmpresa.trim().length < 2 ? [] : sugestoes;

  function selecionarEmpresa(e: EmpresaResumo) {
    setEmpresa(e);
    setBuscaEmpresa(e.nome);
    setSugestoes([]);
    setNovaEmpresaAberta(false);
    setContatoId("");
  }

  function criarNovaEmpresa() {
    setErro(null);
    startTransition(async () => {
      const res = await criarEmpresa({
        nome: novaEmpresa.nome || buscaEmpresa,
        cidade: novaEmpresa.cidade || null,
        segmento: novaEmpresa.segmento || null,
        uf: null,
        cnpj: null,
        responsavel_id: null,
        observacoes: null,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      selecionarEmpresa(res.empresa);
    });
  }

  function salvar() {
    setErro(null);
    if (!empresa) {
      setErro("Selecione ou crie uma empresa.");
      return;
    }
    if (!funilId) {
      setErro("Selecione um funil.");
      return;
    }
    const valor = parseMoedaBR(valorTexto);
    if (valor == null) {
      setErro("Valor aproximado inválido.");
      return;
    }

    startTransition(async () => {
      const res = await criarNegociacao({
        empresa_id: empresa.id,
        valor_estimado: valor,
        funil_id: funilId,
        linha: linha || null,
          titulo: tituloExibido.trim() || null,
        origem: origem || null,
        temperatura,
          previsao_mes: `${previsaoMes}-01`,
          contato_id: contatoId || null,
          proxima_acao:
          !pularAcao && acaoDesc.trim()
            ? { descricao: acaoDesc.trim(), data: acaoData, tipo: "ligar" }
            : null,
      });
      // redirect() não retorna; se chegou aqui, é erro
      if (res && !res.ok) {
        setErro(res.error);
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Empresa */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="neg-empresa">
          Empresa *
        </label>
        {empresa ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{empresa.nome}</p>
              {(empresa.cidade || empresa.segmento) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[empresa.cidade, empresa.segmento]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={pending}
              onClick={() => {
                setEmpresa(null);
                setBuscaEmpresa("");
              }}
            >
              Trocar
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              id="neg-empresa"
              value={buscaEmpresa}
              onChange={(e) => setBuscaEmpresa(e.target.value)}
              placeholder="Buscar empresa…"
              disabled={pending}
              autoComplete="off"
            />
            {(sugestoesVisiveis.length > 0 ||
              (buscaEmpresa.trim().length >= 2 && !buscando && !empresa)) && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
                {sugestoesVisiveis.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => selecionarEmpresa(s)}
                    >
                      <span className="font-medium">{s.nome}</span>
                      {(s.cidade || s.segmento) && (
                        <span className="text-xs text-muted-foreground">
                          {[s.cidade, s.segmento].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm text-primary hover:bg-muted"
                    onClick={() => {
                      setNovaEmpresaAberta(true);
                      setNovaEmpresa((n) => ({
                        ...n,
                        nome: buscaEmpresa.trim(),
                      }));
                    }}
                  >
                    <Plus className="size-4" />
                    Nova empresa
                    {buscaEmpresa.trim()
                      ? `: “${buscaEmpresa.trim()}”`
                      : ""}
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}

        {novaEmpresaAberta && !empresa ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-sm font-medium">Nova empresa</p>
            <Input
              value={novaEmpresa.nome}
              onChange={(e) =>
                setNovaEmpresa((n) => ({ ...n, nome: e.target.value }))
              }
              placeholder="Nome *"
              disabled={pending}
            />
            <Input
              value={novaEmpresa.cidade}
              onChange={(e) =>
                setNovaEmpresa((n) => ({ ...n, cidade: e.target.value }))
              }
              placeholder="Cidade"
              disabled={pending}
            />
            <select
              value={novaEmpresa.segmento}
              onChange={(e) =>
                setNovaEmpresa((n) => ({ ...n, segmento: e.target.value }))
              }
              disabled={pending}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Segmento</option>
              {dados.segmentos.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !novaEmpresa.nome.trim()}
                onClick={criarNovaEmpresa}
              >
                {pending ? "Salvando…" : "Usar esta empresa"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setNovaEmpresaAberta(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Valor */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="neg-valor">
          Valor aproximado *
        </label>
        <Input
          id="neg-valor"
          inputMode="decimal"
          value={valorTexto}
          onChange={(e) => setValorTexto(e.target.value)}
          placeholder="R$ 0,00"
          disabled={pending}
        />
      </div>

      {/* Funil + Linha */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="neg-funil">
            Funil
          </label>
          <select
            id="neg-funil"
            value={funilId}
            onChange={(e) => setFunilId(e.target.value)}
            disabled={pending}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {dados.funis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="neg-linha">
            Linha
          </label>
          <select
            id="neg-linha"
            value={linha}
            onChange={(e) => setLinha(e.target.value)}
            disabled={pending}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">—</option>
            {dados.linhas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Próxima ação */}
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Próxima ação</p>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={pularAcao}
              onChange={(e) => setPularAcao(e.target.checked)}
              disabled={pending}
            />
            Pular
          </label>
        </div>
        {!pularAcao ? (
          <>
            <Textarea
              value={acaoDesc}
              onChange={(e) => setAcaoDesc(e.target.value)}
              placeholder="Ex.: Ligar para apresentar"
              rows={2}
              disabled={pending}
            />
            <Input
              type="date"
              value={acaoData}
              onChange={(e) => setAcaoData(e.target.value)}
              disabled={pending}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => setAcaoData(adicionarDiasISO(hojeISO(), 1))}
              >
                Amanhã
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => setAcaoData(adicionarDiasISO(hojeISO(), 3))}
              >
                +3 dias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => setAcaoData(proximaSegundaISO())}
              >
                Próxima semana
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            A negociação ficará marcada como sem próxima ação.
          </p>
        )}
      </div>

      {/* Mais detalhes */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setMaisAberto((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              maisAberto && "rotate-180",
            )}
          />
          Mais detalhes
        </button>
        {maisAberto ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="neg-titulo">
                Título
              </label>
              <Input
                id="neg-titulo"
                value={tituloExibido}
                onChange={(e) => {
                  setTituloManual(true);
                  setTitulo(e.target.value);
                }}
                placeholder={tituloSugerido || "Título"}
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="neg-origem">
                Origem
              </label>
              <select
                id="neg-origem"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                disabled={pending}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">—</option>
                {dados.origens.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Temperatura</span>
              <div className="flex gap-1.5">
                {(
                  [
                    [1, "Fria"],
                    [2, "Morna"],
                    [3, "Quente"],
                  ] as const
                ).map(([v, label]) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={temperatura === v ? "default" : "outline"}
                    disabled={pending}
                    onClick={() => setTemperatura(v)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="neg-previsao">
                Previsão
              </label>
              <Input
                id="neg-previsao"
                type="month"
                value={previsaoMes}
                onChange={(e) => setPrevisaoMes(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="neg-contato">
                Contato
              </label>
              <select
                id="neg-contato"
                value={contatoId}
                onChange={(e) => setContatoId(e.target.value)}
                disabled={pending || !empresa}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">—</option>
                {contatosVisiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {onCancelar ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancelar}
          >
            Cancelar
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={pending || !empresa}
          onClick={salvar}
          className="min-w-28"
        >
          {pending ? "Criando…" : "Criar negociação"}
        </Button>
      </div>
    </div>
  );
}
