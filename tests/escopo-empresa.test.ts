import { describe, expect, it } from "vitest";

import {
  aplicarEscopoEmitente,
  encontrarEmpresa,
  resolverEscopo,
} from "@/lib/auth/escopo-empresa-core";
import type { EmpresaDoUsuario } from "@/lib/auth/get-usuario-atual";

const A: EmpresaDoUsuario = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  nome: "F-Led",
  perfil: "diretor",
  gerenteId: null,
  ativo: true,
};
const B: EmpresaDoUsuario = {
  id: "bbbbbbbb-0000-0000-0000-000000000002",
  nome: "Formosa Smart Energy",
  perfil: "vendedor",
  gerenteId: null,
  ativo: true,
};

describe("resolverEscopo", () => {
  it("usuário com uma empresa fica fixo nela, ignorando cookie e URL", () => {
    const e = resolverEscopo([A], { param: "todas", cookie: B.id });
    expect(e.fixo).toBe(true);
    expect(e.emitenteId).toBe(A.id);
    expect(e.paramInvalido).toBe(false);
  });

  it("sem cookie nem URL = todas", () => {
    const e = resolverEscopo([A, B]);
    expect(e.emitenteId).toBeNull();
    expect(e.fixo).toBe(false);
  });

  it("cookie válido seleciona a empresa", () => {
    expect(resolverEscopo([A, B], { cookie: B.id }).emitente?.nome).toBe(B.nome);
  });

  it("cookie de empresa que o usuário não tem é ignorado", () => {
    expect(resolverEscopo([A], { cookie: "cccccccc-0000-0000-0000-000000000003" }).emitenteId).toBe(A.id);
    expect(resolverEscopo([A, B], { cookie: "cccccccc-0000-0000-0000-000000000003" }).emitenteId).toBeNull();
  });

  it("?emitente= tem prioridade sobre o cookie e 'todas' limpa", () => {
    expect(resolverEscopo([A, B], { param: A.id, cookie: B.id }).emitenteId).toBe(A.id);
    expect(resolverEscopo([A, B], { param: "todas", cookie: B.id }).emitenteId).toBeNull();
    expect(resolverEscopo([A, B], { param: ["todas"], cookie: B.id }).emitenteId).toBeNull();
  });

  it("?emitente= inválido marca paramInvalido e cai para o cookie", () => {
    const e = resolverEscopo([A, B], { param: "xpto", cookie: B.id });
    expect(e.paramInvalido).toBe(true);
    expect(e.emitenteId).toBe(B.id);
  });

  it("empresas inativas não entram no escopo", () => {
    const e = resolverEscopo([A, { ...B, ativo: false }], { cookie: B.id });
    expect(e.fixo).toBe(true);
    expect(e.emitenteId).toBe(A.id);
  });
});

describe("encontrarEmpresa", () => {
  it("aceita id, nome exato sem acento/caixa e trecho do nome", () => {
    expect(encontrarEmpresa([A, B], B.id)?.id).toBe(B.id);
    expect(encontrarEmpresa([A, B], "f-led")?.id).toBe(A.id);
    expect(encontrarEmpresa([A, B], "formosa")?.id).toBe(B.id);
    expect(encontrarEmpresa([A, B], "")).toBeNull();
    expect(encontrarEmpresa([A, B], "inexistente")).toBeNull();
  });
});

describe("aplicarEscopoEmitente", () => {
  it("só aplica eq quando há empresa selecionada", () => {
    const chamadas: [string, string][] = [];
    const q = { eq: (c: string, v: string) => (chamadas.push([c, v]), q) };
    aplicarEscopoEmitente(q, { emitenteId: null });
    expect(chamadas).toEqual([]);
    aplicarEscopoEmitente(q, { emitenteId: A.id }, "negociacoes.emitente_id");
    expect(chamadas).toEqual([["negociacoes.emitente_id", A.id]]);
  });
});
