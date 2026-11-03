import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Liga Regional de Tenis de Mesa Los Ríos",
    short_name: "Liga Los Ríos",
    description: "Competencias, programación y resultados de tenis de mesa",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1726",
    theme_color: "#d52a36",
    lang: "es-CL",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
