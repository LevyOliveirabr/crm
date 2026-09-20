"use client";

import { useState } from "react";

import { EmitenteForm } from "@/components/crm/emitente-form";
import type { EmitenteRow } from "@/lib/actions/emitentes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/toast";

type Item = EmitenteRow & { podeEditar: boolean; logoUrl: string | null };

export function EmitentesConfigClient({ empresas }: { empresas: Item[] }) {
  const [editando, setEditando] = useState<Item | null>(null);
  const [novo, setNovo] = useState(false);

  return (
    <Toaster>
      <div className="flex flex-col gap-6">
        <div>
          <Button
            type="button"
            onClick={() => {
              setEditando(null);
              setNovo(true);
            }}
          >
            + Empresa vendedora
          </Button>
        </div>

        {novo ? (
          <EmitenteForm
            initial={null}
            logoUrl={null}
            onCancelar={() => setNovo(false)}
            onSalvo={() => setNovo(false)}
          />
        ) : null}

        {editando ? (
          <EmitenteForm
            key={editando.id}
            initial={editando}
            logoUrl={editando.logoUrl}
            onCancelar={() => setEditando(null)}
          />
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Razão social</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Orçamentos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {e.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.logoUrl} alt="" className="h-6 w-auto max-w-[3rem] object-contain" />
                    ) : null}
                    {e.nome}
                  </span>
                </TableCell>
                <TableCell>{e.razao_social}</TableCell>
                <TableCell className="font-mono text-xs">{e.cnpj ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {e.orcamento_prefixo}-… próximo nº {e.orcamento_proximo_numero}
                </TableCell>
                <TableCell>
                  <Badge variant={e.ativo ? "secondary" : "outline"}>
                    {e.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {e.podeEditar ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNovo(false);
                        setEditando(e);
                      }}
                    >
                      Editar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem permissão</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {empresas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Nenhuma empresa vendedora.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Toaster>
  );
}
