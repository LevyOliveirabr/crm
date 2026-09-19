/** Utilidades puras de CNPJ (sem I/O), testáveis. */

export function apenasDigitosCnpj(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Valida os dígitos verificadores do CNPJ (aceita com ou sem máscara). */
export function validarCnpj(cnpj: string): boolean {
  const d = apenasDigitosCnpj(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, ch, i) => s + Number(ch) * pesos[i]!, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  const dv1 = calc(d.slice(0, 12), p1);
  const dv2 = calc(d.slice(0, 12) + dv1, p2);
  return d.endsWith(`${dv1}${dv2}`);
}

/** 00.000.000/0000-00 */
export function formatarCnpj(cnpj: string): string {
  const d = apenasDigitosCnpj(cnpj);
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
