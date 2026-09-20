"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  salvarEmitente,
  uploadLogoEmitente,
  type EmitenteRow,
} from "@/lib/actions/emitentes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formularioClass } from "@/components/crm/pagina";
import { cn } from "@/lib/utils";

/** Formulário de uma empresa vendedora (criação ou edição) + logo. */
export function EmitenteForm({
  initial,
  logoUrl,
  onSalvo,
  onCancelar,
}: {
  initial: EmitenteRow | null;
  logoUrl: string | null;
  onSalvo?: (id: string) => void;
  onCancelar?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logo, setLogo] = useState(logoUrl);

  return (
    <div className={cn(formularioClass, "flex max-w-xl flex-col gap-6")}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const str = (k: string) => String(fd.get(k) ?? "").trim();
          startTransition(async () => {
            const res = await salvarEmitente(initial?.id ?? null, {
              nome: str("nome"),
              razao_social: str("razao_social"),
              cnpj: str("cnpj") || null,
              endereco: str("endereco") || null,
              telefone: str("telefone") || null,
              email: str("email") || null,
              site: str("site") || null,
              validade_padrao_dias: Number(
                fd.get("validade_padrao_dias") ?? 15,
              ),
              condicoes_pagamento_padrao:
                str("condicoes_pagamento_padrao") || null,
              prazo_entrega_padrao: str("prazo_entrega_padrao") || null,
              rodape: str("rodape") || null,
              orcamento_prefixo: str("orcamento_prefixo") || "ORC",
              ativo: fd.get("ativo") === "on",
            });
            if (!res.ok) {
              toast.add({ title: res.error, type: "error" });
              return;
            }
            toast.add({
              title: res.message ?? "Empresa salva",
              type: "success",
            });
            router.refresh();
            if (res.id) onSalvo?.(res.id);
          });
        }}
      >
        <h2 className="font-medium">
          {initial ? `Editar ${initial.nome}` : "Nova empresa vendedora"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Nome curto *
            <Input
              name="nome"
              required
              className="mt-1"
              defaultValue={initial?.nome ?? ""}
              placeholder="Ex.: F-Led"
            />
          </label>
          <label className="text-sm">
            Prefixo do orçamento
            <Input
              name="orcamento_prefixo"
              className="mt-1"
              defaultValue={initial?.orcamento_prefixo ?? "ORC"}
            />
          </label>
        </div>
        <label className="text-sm">
          Razão social *
          <Input
            name="razao_social"
            required
            className="mt-1"
            defaultValue={initial?.razao_social ?? ""}
          />
        </label>
        <label className="text-sm">
          CNPJ
          <Input
            name="cnpj"
            className="mt-1"
            defaultValue={initial?.cnpj ?? ""}
          />
        </label>
        <label className="text-sm">
          Endereço
          <Input
            name="endereco"
            className="mt-1"
            defaultValue={initial?.endereco ?? ""}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Telefone
            <Input
              name="telefone"
              className="mt-1"
              defaultValue={initial?.telefone ?? ""}
            />
          </label>
          <label className="text-sm">
            E-mail
            <Input
              name="email"
              type="email"
              className="mt-1"
              defaultValue={initial?.email ?? ""}
            />
          </label>
        </div>
        <label className="text-sm">
          Site (aparece na proposta)
          <Input
            name="site"
            className="mt-1"
            placeholder="https://"
            defaultValue={initial?.site ?? ""}
          />
        </label>
        <label className="text-sm">
          Validade padrão do orçamento (dias)
          <Input
            name="validade_padrao_dias"
            type="number"
            min={1}
            className="mt-1"
            defaultValue={initial?.validade_padrao_dias ?? 15}
          />
        </label>
        <label className="text-sm">
          Condições de pagamento padrão
          <Textarea
            name="condicoes_pagamento_padrao"
            className="mt-1"
            rows={2}
            defaultValue={initial?.condicoes_pagamento_padrao ?? ""}
          />
        </label>
        <label className="text-sm">
          Prazo de entrega padrão
          <Input
            name="prazo_entrega_padrao"
            className="mt-1"
            defaultValue={initial?.prazo_entrega_padrao ?? ""}
          />
        </label>
        <label className="text-sm">
          Rodapé legal da proposta
          <Textarea
            name="rodape"
            className="mt-1"
            rows={3}
            defaultValue={initial?.rodape ?? ""}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={initial?.ativo ?? true}
          />
          Ativa
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          {onCancelar ? (
            <Button type="button" variant="outline" onClick={onCancelar}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>

      {initial ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Logo</h3>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={`Logo de ${initial.nome}`}
              className="h-16 w-auto object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum logo enviado.
            </p>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await uploadLogoEmitente(initial.id, fd);
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                toast.add({ title: "Logo enviado", type: "success" });
                const file = fd.get("logo");
                if (file instanceof File) setLogo(URL.createObjectURL(file));
                router.refresh();
              });
            }}
          >
            <Input name="logo" type="file" accept="image/*" required />
            <Button type="submit" variant="secondary" disabled={pending}>
              Enviar logo
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
