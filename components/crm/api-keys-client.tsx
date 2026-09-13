"use client";

import { useState, useTransition } from "react";

import {
  gerarApiKey,
  revogarApiKey,
  type ApiKeyResumo,
} from "@/lib/actions/api-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataHora } from "@/lib/format";

export function ApiKeysClient({ keysIniciais }: { keysIniciais: ApiKeyResumo[] }) {
  const [keys, setKeys] = useState(keysIniciais);
  const [nome, setNome] = useState("Cursor");
  const [novaKey, setNovaKey] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onGerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setNovaKey(null);
    startTransition(async () => {
      const result = await gerarApiKey(nome);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setNovaKey(result.key);
      setKeys((prev) => [result.registro, ...prev]);
      setNome("Cursor");
    });
  }

  function onRevogar(id: string) {
    setErro(null);
    startTransition(async () => {
      const result = await revogarApiKey(id);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setKeys((prev) =>
        prev.map((k) =>
          k.id === id
            ? { ...k, revogado_em: new Date().toISOString() }
            : k,
        ),
      );
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Gerar nova key</h2>
        <p className="text-sm text-muted-foreground">
          A key completa só aparece uma vez. Use no Cursor, Claude Desktop ou Grok
          (variável de ambiente <code>CRM_FLED_API_KEY</code>).
        </p>
        <form onSubmit={onGerar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="nome-key" className="text-sm font-medium">
              Nome
            </label>
            <Input
              id="nome-key"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Grok bot, Cursor, Claude"
              required
              maxLength={80}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Gerando…" : "Gerar key"}
          </Button>
        </form>
        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
        {novaKey ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-1 text-sm font-medium">Copie agora — não será mostrada de novo</p>
            <code className="block break-all text-sm">{novaKey}</code>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Suas keys</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.nome}</TableCell>
                <TableCell>{formatarDataHora(k.criado_em)}</TableCell>
                <TableCell>
                  <Badge variant={k.revogado_em ? "outline" : "secondary"}>
                    {k.revogado_em ? "Revogada" : "Ativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {!k.revogado_em ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => onRevogar(k.id)}
                    >
                      Revogar
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Nenhuma API key ainda.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
