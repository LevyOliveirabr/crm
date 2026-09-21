"use client";

import { formatarCnpj, apenasDigitosCnpj } from "@/lib/cnpj";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Input de CNPJ com máscara 00.000.000/0000-00 conforme digita. */
export function InputCnpj({
  value,
  onChange,
  onBlur,
  disabled,
  name,
  className,
  id,
  defaultValue,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (valorFormatado: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  name?: string;
  className?: string;
  id?: string;
}) {
  const controlado = value !== undefined;
  const atual = controlado ? value : undefined;

  function mascarar(raw: string): string {
    const d = apenasDigitosCnpj(raw).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length <= 12) {
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    }
    return formatarCnpj(d);
  }

  return (
    <Input
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      placeholder="00.000.000/0000-00"
      disabled={disabled}
      className={cn(className)}
      {...(controlado
        ? {
            value: atual ?? "",
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
              onChange?.(mascarar(ev.target.value)),
          }
        : {
            defaultValue: defaultValue ? mascarar(defaultValue) : "",
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
              const fmt = mascarar(ev.target.value);
              ev.target.value = fmt;
              onChange?.(fmt);
            },
          })}
      onBlur={onBlur}
    />
  );
}
