"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  salvarEmitente,
  uploadLogoEmitente,
  type EmitenteRow,
} from "@/lib/actions/emitentes";
import { BotaoConsultarCnpj } from "@/components/crm/botao-consultar-cnpj";
import { InputCnpj } from "@/components/crm/input-cnpj";
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
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? "");
  const [razaoSocial, setRazaoSocial] = useState(initial?.razao_social ?? "");
  const [logradouro, setLogradouro] = useState(initial?.logradouro ?? "");
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [complemento, setComplemento] = useState(initial?.complemento ?? "");
  const [bairro, setBairro] = useState(initial?.bairro ?? "");
  const [cep, setCep] = useState(initial?.cep ?? "");
  const [municipio, setMunicipio] = useState(initial?.municipio ?? "");

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
              razao_social: razaoSocial.trim() || str("razao_social"),
              cnpj: cnpj || null,
              endereco: null,
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
              logradouro: logradouro || null,
              numero: numero || null,
              complemento: complemento || null,
              bairro: bairro || null,
              cep: cep || null,
              municipio: municipio || null,
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
            value={razaoSocial}
            onChange={(ev) => setRazaoSocial(ev.target.value)}
          />
        </label>
        <div className="text-sm">
          <span>CNPJ</span>
          <InputCnpj
            name="cnpj"
            className="mt-1"
            value={cnpj}
            onChange={setCnpj}
          />
          <div className="mt-1.5">
            <BotaoConsultarCnpj
              cnpj={cnpj}
              onDados={(d) => {
                setCnpj(d.cnpj);
                if (!razaoSocial.trim()) setRazaoSocial(d.razaoSocial);
                if (!logradouro) setLogradouro(d.logradouro ?? "");
                if (!numero) setNumero(d.numero ?? "");
                if (!complemento) setComplemento(d.complemento ?? "");
                if (!bairro) setBairro(d.bairro ?? "");
                if (!cep) setCep(d.cep ?? "");
                if (!municipio) setMunicipio(d.municipio ?? d.cidade ?? "");
              }}
            />
          </div>
        </div>
        <p className="text-sm font-medium">Endereço</p>
        <label className="text-sm">
          Logradouro
          <Input
            className="mt-1"
            value={logradouro}
            onChange={(ev) => setLogradouro(ev.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Número
            <Input
              className="mt-1"
              value={numero}
              onChange={(ev) => setNumero(ev.target.value)}
            />
          </label>
          <label className="text-sm">
            Complemento
            <Input
              className="mt-1"
              value={complemento}
              onChange={(ev) => setComplemento(ev.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Bairro
            <Input
              className="mt-1"
              value={bairro}
              onChange={(ev) => setBairro(ev.target.value)}
            />
          </label>
          <label className="text-sm">
            CEP
            <Input
              className="mt-1"
              value={cep}
              inputMode="numeric"
              placeholder="00000-000"
              onChange={(ev) => {
                const d = ev.target.value.replace(/\D/g, "").slice(0, 8);
                setCep(d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d);
              }}
            />
          </label>
        </div>
        <label className="text-sm">
          Município
          <Input
            className="mt-1"
            value={municipio}
            onChange={(ev) => setMunicipio(ev.target.value)}
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
