import { describe, expect, it } from "vitest";

import { prefixoAgente } from "@/lib/mcp/agente";
import {
  acharPorNome,
  camposContatoAlterados,
  camposEmpresaAlterados,
  decidirEmpresaExistente,
  filtroBuscaEmpresa,
  juntarRotulos,
  paraLinhaEmpresa,
} from "@/lib/empresas/cadastro";
import {
  adicionarContatoArgsSchema,
  atualizarContatoArgsSchema,
  atualizarEmpresaArgsSchema,
  criarEmpresaArgsSchema,
} from "@/lib/schemas/mcp";

const CNPJ_OK = "11.222.333/0001-81";

describe("criar_empresa", () => {
  it("aceita CNPJ e CEP com ou sem máscara e formata", () => {
    const parsed = criarEmpresaArgsSchema.safeParse({
      nome: "Remo",
      cnpj: "11222333000181",
      cep: "01310100",
      uf: "sp",
      email: "Vendas@Remo.com",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.cnpj).toBe(CNPJ_OK);
    expect(parsed.data.cep).toBe("01310-100");
    expect(parsed.data.uf).toBe("SP");
    expect(parsed.data.email).toBe("vendas@remo.com");
    expect(parsed.data.razao_social).toBeUndefined();
  });

  it("aceita CEP mascarado e rejeita CEP curto ou CNPJ inválido", () => {
    const cep = criarEmpresaArgsSchema.safeParse({
      nome: "Remo",
      cep: "01310-100",
    });
    expect(cep.success).toBe(true);
    if (cep.success) expect(cep.data.cep).toBe("01310-100");

    const curto = criarEmpresaArgsSchema.safeParse({ nome: "Remo", cep: "0131010" });
    expect(curto.success).toBe(false);

    const cnpj = criarEmpresaArgsSchema.safeParse({
      nome: "Remo",
      cnpj: "11.222.333/0001-80",
    });
    expect(cnpj.success).toBe(false);
    if (!cnpj.success) expect(cnpj.error.issues[0]?.message).toBe("CNPJ inválido");
  });

  it("não duplica: nome e CNPJ da mesma empresa reutilizam; se divergirem, conflita", () => {
    const mesma = decidirEmpresaExistente(
      { id: "a", nome: "Remo" },
      { id: "a", nome: "Remo Engenharia" },
    );
    expect(mesma.tipo).toBe("existente");
    if (mesma.tipo === "existente") {
      expect(mesma.aviso).toContain("id=a");
      expect(mesma.aviso).toContain("Nada foi duplicado");
    }

    const soNome = decidirEmpresaExistente({ id: "a", nome: "Remo" }, null);
    expect(soNome.tipo).toBe("existente");

    const conflito = decidirEmpresaExistente(
      { id: "a", nome: "Remo" },
      { id: "b", nome: "Outra" },
    );
    expect(conflito.tipo).toBe("conflito");

    expect(decidirEmpresaExistente(null, null).tipo).toBe("criar");
  });
});

describe("atualizar_empresa", () => {
  it("exige ao menos um campo e não inclui o que foi omitido", () => {
    const vazio = atualizarEmpresaArgsSchema.safeParse({
      empresa_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(vazio.success).toBe(false);

    const parsed = atualizarEmpresaArgsSchema.safeParse({
      empresa_id: "11111111-1111-4111-8111-111111111111",
      telefone: "1133334444",
      cnpj: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.telefone).toBe("1133334444");
    expect(parsed.data.cnpj).toBeNull();
    expect(parsed.data.cidade).toBeUndefined();
    expect(parsed.data.email).toBeUndefined();
  });

  it("cidade enviada espelha município; campo igual não entra na timeline", () => {
    const linha = paraLinhaEmpresa({ cidade: "Campinas", telefone: "19 9999" });
    expect(linha.municipio).toBe("Campinas");
    expect(linha.razao_social).toBeUndefined();

    const mudou = camposEmpresaAlterados(
      { cidade: "Campinas", municipio: "Campinas", telefone: "19 9999", cnpj: null },
      linha,
    );
    expect(mudou).toEqual([]);

    const trocou = camposEmpresaAlterados(
      { cidade: "São Paulo", municipio: "São Paulo", telefone: null },
      paraLinhaEmpresa({ telefone: "11 2222" }),
    );
    expect(trocou).toEqual(["telefone"]);
    expect(juntarRotulos(["telefone", "CNPJ", "e-mail"])).toBe(
      "telefone, CNPJ e e-mail",
    );
  });
});

describe("contatos", () => {
  it("principal aceita sim e não", () => {
    const sim = adicionarContatoArgsSchema.safeParse({
      empresa_id: "11111111-1111-4111-8111-111111111111",
      nome: "Maria",
      principal: "não",
      whatsapp: "(31) 99999-8888",
    });
    expect(sim.success).toBe(true);
    if (!sim.success) return;
    expect(sim.data.principal).toBe(false);
    expect(sim.data.whatsapp).toBe("31999998888");

    const invalido = adicionarContatoArgsSchema.safeParse({
      empresa_id: "11111111-1111-4111-8111-111111111111",
      nome: "Maria",
      principal: "talvez",
    });
    expect(invalido.success).toBe(false);
  });

  it("atualizar contato sem campo falha; nome igual não conta como mudança", () => {
    const vazio = atualizarContatoArgsSchema.safeParse({
      contato_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(vazio.success).toBe(false);

    const mudou = camposContatoAlterados(
      {
        nome: "Maria",
        cargo: "Compras",
        telefone: null,
        whatsapp: null,
        email: null,
        principal: false,
      },
      { principal: true, cargo: "Compras" },
    );
    expect(mudou).toEqual(["principal"]);
  });

  it("acha contato pelo nome sem acento", () => {
    const hit = acharPorNome(
      [{ id: "1", nome: "João Souza" }],
      "joao souza",
    );
    expect(hit?.id).toBe("1");
  });
});

describe("buscar_empresa", () => {
  it("trata texto de CNPJ como busca por dígitos", () => {
    expect(filtroBuscaEmpresa("11.222.333/0001-81")).toEqual({
      modo: "cnpj",
      digitos: "11222333000181",
    });
    expect(filtroBuscaEmpresa("Remo, Engenharia")).toEqual({
      modo: "nome",
      nome: "Remo Engenharia",
    });
  });
});

describe("timeline do agente", () => {
  it("prefixa [agente] uma vez", () => {
    expect(prefixoAgente("Empresa criada: Remo.")).toBe(
      "[agente] Empresa criada: Remo.",
    );
    expect(prefixoAgente("[agente] já tinha")).toBe("[agente] já tinha");
    expect(prefixoAgente("")).toBe("[agente]");
  });
});
