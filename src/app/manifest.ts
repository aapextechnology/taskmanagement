import type { MetadataRoute } from "next";

// PWA manifest (T-103). Backstage crews work from phones in venues, so the
// app is installable and opens standalone — no browser chrome eating the
// viewport. Monochrome to match the RVC theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RVC Backstage",
    short_name: "Backstage",
    description:
      "Everything behind the show — task management for Raw Vision Collective.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "My tasks", url: "/my-tasks" },
      { name: "Approvals", url: "/approvals" },
    ],
  };
}
