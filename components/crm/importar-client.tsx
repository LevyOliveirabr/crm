"use client";

import { useState, useTransition } from "react";

import {
  confirmarImportacao,
  previaImportacao,
  type ImportPreview,
  type ImportRelatorio,
  type TipoImportacao,
} from "@/lib/actions/importacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster, toast } from "@/components/ui/toast";
import { formularioClass, subPainelClass } from "@/components/crm/pagina";
import { cn } from "@/lib/utils";

const TIPOS: { tipo: TipoImportacao; label: string; ordem: number }[] = [
  { tipo: "empresas", label: "Empresas", ordem: 1 },
  { tipo: "contatos", label: "Contatos", ordem: 2 },
  { tipo: "negociacoes", label: "Negociações", ordem: 3 },
  { tipo: "produtos", label: "Produtos", ordem: 4 },
];

function BlocoImport({ tipo, label }: { tipo: TipoImportacao; label: string }) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [relatorio, setRelatorio] = useState<ImportRelatorio | null>(null);

  return (
    <section className={subPainelClass}>
      <h3 className="font-heading text-sm font-semibold">{label}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Layout em <code className="text-xs">modelos/{tipo}.csv</code>
      </p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setRelatorio(null);
          const fd = new FormData(e.currentTarget);
          fd.set("tipo", tipo);
          startTransition(async () => {
            const res = await previaImportacao(fd);
            if (!res.ok) {
              toast.add({ title: res.error, type: "error" });
              setPreview(null);
              return;
            }
            setPreview(res.preview);
          });
        }}
      >
        <Input name="arquivo" type="file" accept=".csv,text/csv" required />
        <Button type="submit" variant="secondary" disabled={pending}>
          Prévia
        </Button>
      </form>

      {preview ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Separador <strong>{preview.separator}</strong> · encoding{" "}
            <strong>{preview.encoding}</strong> · {preview.totalLinhas} linha(s)
          </p>

          <div className="flex flex-wrap gap-2 text-xs">
            {preview.mapeamento.map((m) => (
              <span
                key={m.esperado}
                className={
                  m.encontrado
                    ? "rounded bg-muted px-2 py-1"
                    : "rounded bg-destructive/10 px-2 py-1 text-destructive"
                }
              >
                {m.esperado}
                {m.encontrado ? "" : " (ausente)"}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.mapeamento
                    .filter((m) => m.encontrado)
                    .map((m) => (
                      <TableHead key={m.esperado}>{m.esperado}</TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.preview.map((row, idx) => (
                  <TableRow key={idx}>
                    {preview.mapeamento
                      .filter((m) => m.encontrado)
                      .map((m) => (
                        <TableCell
                          key={m.esperado}
                          className="max-w-[10rem] truncate"
                        >
                          {row[m.esperado] || "—"}
                        </TableCell>
                      ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await confirmarImportacao({
                  tipo: preview.tipo,
                  arquivoB64: preview.arquivoB64,
                });
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                setRelatorio(res.relatorio);
                toast.add({ title: "Importação concluída", type: "success" });
              });
            }}
          >
            Confirmar importação
          </Button>
        </div>
      ) : null}

      {relatorio ? (
        <div className={cn(formularioClass, "mt-4 space-y-2 text-sm")}>
          <p>
            Importadas: <strong>{relatorio.importadas}</strong> · Reutilizadas:{" "}
            <strong>{relatorio.reutilizadas}</strong> · Erros/avisos:{" "}
            <strong>{relatorio.erros.length}</strong>
          </p>
          {relatorio.erros.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {relatorio.erros.map((e, i) => (
                <li key={i}>
                  Linha {e.linha}
                  {e.nivel === "aviso" ? " (aviso)" : ""}: {e.motivo}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function ImportarClient() {
  return (
    <Toaster>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Importe nesta ordem: empresas → contatos → negociações → produtos.
          Encoding UTF-8 ou Latin-1; separador <code>;</code> ou <code>,</code>.
        </p>
        {TIPOS.map((t) => (
          <BlocoImport
            key={t.tipo}
            tipo={t.tipo}
            label={`${t.ordem}. ${t.label}`}
          />
        ))}
      </div>
    </Toaster>
  );
}
