import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "F-Led CRM Comercial",
    short_name: "F-Led CRM",
    description: "CRM comercial da F-Led: carteira, funil, ações do dia e relatórios.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f2ef",
    theme_color: "#0f0f0f",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Meu dia", url: "/hoje", description: "Ações atrasadas e de hoje" },
      { name: "Funil", url: "/funil", description: "Kanban de negociações" },
      { name: "Nova negociação", url: "/negociacoes/nova" },
    ],
  };
}
