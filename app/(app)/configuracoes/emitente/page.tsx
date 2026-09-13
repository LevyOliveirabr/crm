import { EmitenteForm } from "@/components/crm/emitente-form";
import { obterEmitente } from "@/lib/actions/config";
import { createClient } from "@/lib/supabase/server";

export default async function EmitentePage() {
  const emitente = await obterEmitente();
  let logoUrl: string | null = null;
  if (emitente?.logo_path) {
    const supabase = await createClient();
    const { data } = supabase.storage
      .from("publico")
      .getPublicUrl(emitente.logo_path);
    logoUrl = data.publicUrl;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Emitente</h2>
        <p className="text-sm text-muted-foreground">
          Dados do cabeçalho dos orçamentos e logo (bucket público).
        </p>
      </div>
      <EmitenteForm initial={emitente} logoUrl={logoUrl} />
    </div>
  );
}
