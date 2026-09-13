"use client";

import { useState, useTransition } from "react";

import {
  salvarEmitente,
  uploadLogoEmitente,
} from "@/lib/actions/config";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "@/components/ui/toast";

type Emitente = Database["public"]["Tables"]["emitente"]["Row"];

export function EmitenteForm({
  initial,
  logoUrl,
}: {
  initial: Emitente | null;
  logoUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [logo, setLogo] = useState(logoUrl);

  return (
    <Toaster>
      <div className="flex max-w-xl flex-col gap-8">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await salvarEmitente({
                razao_social: String(fd.get("razao_social") ?? ""),
                cnpj: String(fd.get("cnpj") ?? "") || null,
                endereco: String(fd.get("endereco") ?? "") || null,
                telefone: String(fd.get("telefone") ?? "") || null,
                email: String(fd.get("email") ?? "") || null,
                site: String(fd.get("site") ?? "") || null,
                validade_padrao_dias: Number(fd.get("validade_padrao_dias") ?? 15),
                condicoes_pagamento_padrao:
                  String(fd.get("condicoes_pagamento_padrao") ?? "") || null,
                prazo_entrega_padrao:
                  String(fd.get("prazo_entrega_padrao") ?? "") || null,
                rodape: String(fd.get("rodape") ?? "") || null,
              });
              if (!res.ok) {
                toast.add({ title: res.error, type: "error" });
                return;
              }
              toast.add({ title: "Emitente salvo", type: "success" });
            });
          }}
        >
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
            <Input name="cnpj" className="mt-1" defaultValue={initial?.cnpj ?? ""} />
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
            Site
            <Input name="site" className="mt-1" defaultValue={initial?.site ?? ""} />
          </label>
          <label className="text-sm">
            Validade padrão (dias)
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
            Rodapé legal
            <Textarea
              name="rodape"
              className="mt-1"
              rows={3}
              defaultValue={initial?.rodape ?? ""}
            />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar emitente"}
          </Button>
        </form>

        <section className="space-y-3">
          <h2 className="text-base font-medium">Logo</h2>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt="Logo do emitente"
              className="h-16 w-auto object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum logo enviado.</p>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await uploadLogoEmitente(fd);
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                toast.add({ title: "Logo enviado", type: "success" });
                // força refresh visual: o path muda a cada upload
                const file = fd.get("logo");
                if (file instanceof File) {
                  setLogo(URL.createObjectURL(file));
                }
              });
            }}
          >
            <Input name="logo" type="file" accept="image/*" required />
            <Button type="submit" variant="secondary" disabled={pending}>
              Enviar logo
            </Button>
          </form>
        </section>
      </div>
    </Toaster>
  );
}
