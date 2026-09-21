import { describe, expect, it } from "vitest";

import { montarUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { idsEquipeVisivel, podeVerEquipe } from "@/lib/auth/equipe";
import { ehDiretorDe, ehMembroDe, perfilEm } from "@/lib/auth/permissoes";

const row = {
  id: "u1",
  nome: "Levy",
  email: "levy@x.com",
  perfil: "vendedor" as const,
  ativo: true,
  criado_em: "2026-01-01",
  gerente_id: null,
  cargo: null,
  telefone: null,
  whatsapp: null,
  linkedin: null,
};
const A = { id: "a", nome: "F-Led", perfil: "diretor" as const, gerenteId: null, ativo: true };
const B = { id: "b", nome: "Formosa", perfil: "vendedor" as const, gerenteId: "g1", ativo: true };
const C = { id: "c", nome: "Outra", perfil: "gerente" as const, gerenteId: null, ativo: true };

describe("perfil por empresa", () => {
  it("monta o usuário sem expor o perfil global e calcula o perfil máximo", () => {
    const u = montarUsuarioAtual(row, [B, A]);
    expect("perfil" in u).toBe(false);
    expect(u.ehDiretorEmAlguma).toBe(true);
    expect(u.perfilMaximo).toBe("diretor");
    expect(u.empresas.map((e) => e.nome)).toEqual(["F-Led", "Formosa"]);
  });

  it("perfilEm / ehDiretorDe / ehMembroDe respeitam a empresa", () => {
    const u = montarUsuarioAtual(row, [A, B]);
    expect(perfilEm(u, "a")).toBe("diretor");
    expect(perfilEm(u, "b")).toBe("vendedor");
    expect(perfilEm(u, "z")).toBeNull();
    expect(ehDiretorDe(u, "a")).toBe(true);
    expect(ehDiretorDe(u, "b")).toBe(false);
    expect(ehMembroDe(u, "b")).toBe(true);
    expect(ehMembroDe(u, null)).toBe(false);
  });

  it("vendedor em todas as empresas não vê equipe", () => {
    const u = montarUsuarioAtual(row, [B]);
    expect(u.ehDiretorEmAlguma).toBe(false);
    expect(u.perfilMaximo).toBe("vendedor");
    expect(podeVerEquipe(u)).toBe(false);
    expect(podeVerEquipe(u, { emitenteId: "b" })).toBe(false);
  });

  it("diretor de A e vendedor de B: vê equipe só no escopo de A", () => {
    const u = montarUsuarioAtual(row, [A, B]);
    expect(podeVerEquipe(u, { emitenteId: "a" })).toBe(true);
    expect(podeVerEquipe(u, { emitenteId: "b" })).toBe(false);
    expect(podeVerEquipe(u, null)).toBe(true);
  });

  it("idsEquipeVisivel: null só quando é diretor em todas as empresas consideradas", () => {
    const u = montarUsuarioAtual(row, [A, B, C]);
    const vend = [{ id: "v1", nome: "V1" }];
    expect(idsEquipeVisivel(u, vend, { emitenteId: "a" })).toBeNull();
    expect(idsEquipeVisivel(u, vend, { emitenteId: "c" })).toEqual(["v1", "u1"]);
    expect(idsEquipeVisivel(u, vend, null)).toEqual(["v1", "u1"]);
    expect(idsEquipeVisivel(montarUsuarioAtual(row, [A]), [], null)).toBeNull();
  });
});
