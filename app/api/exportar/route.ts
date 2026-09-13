import { NextResponse } from "next/server";

import { exportarExcel, nomeArquivoComData } from "@/lib/excel";
import { EXPORTACOES_POR_ID } from "@/lib/exportacoes";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function filtrosDaUrl(url: URL): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    if (key === "tela") return;
    out[key] = value;
  });
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tela = url.searchParams.get("tela")?.trim();

  if (!tela) {
    return NextResponse.json(
      { erro: "Parâmetro tela é obrigatório." },
      { status: 400 },
    );
  }

  const registro = EXPORTACOES_POR_ID[tela];
  if (!registro) {
    return NextResponse.json(
      { erro: `Tela de exportação desconhecida: ${tela}` },
      { status: 404 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const filtros = filtrosDaUrl(url);
    const { linhas, filtrosLabel } = await registro.query(filtros, supabase);
    const nomeArquivo = nomeArquivoComData(tela);
    const buffer = await exportarExcel({
      nomeArquivo: tela,
      titulo: registro.titulo,
      filtros: filtrosLabel,
      colunas: registro.colunas,
      linhas,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const mensagem =
      err instanceof Error ? err.message : "Falha ao exportar Excel.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
