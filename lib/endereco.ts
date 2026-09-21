/** Utilitários de endereço e CEP (sem I/O). */

export type EnderecoEstruturado = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf?: string | null;
};

export function apenasDigitosCep(v: string): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 8);
}

/** 00000-000 */
export function formatarCep(cep: string): string {
  const d = apenasDigitosCep(cep);
  if (d.length !== 8) return cep;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Concatena campos estruturados para a coluna legado `endereco` (PDF). */
export function concatenarEndereco(e: EnderecoEstruturado): string | null {
  const partes: string[] = [];
  const rua = [e.logradouro?.trim(), e.numero?.trim()].filter(Boolean).join(", ");
  if (rua) partes.push(rua);
  if (e.complemento?.trim()) partes.push(e.complemento.trim());
  if (e.bairro?.trim()) partes.push(e.bairro.trim());
  const cidadeUf = [e.municipio?.trim(), e.uf?.trim()].filter(Boolean).join(" - ");
  if (cidadeUf) partes.push(cidadeUf);
  if (e.cep?.trim()) {
    const cepFmt = formatarCep(e.cep);
    partes.push(`CEP ${cepFmt}`);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}
