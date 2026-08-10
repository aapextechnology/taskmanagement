import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server bundle — required by the Docker image (T-002).
  output: "standalone",
  // pdfkit loads its AFM font data from node_modules at runtime — keep it
  // external so the standalone tracer ships those files (report PDFs).
  // Baileys is required at runtime, never bundled: it pulls optional deps
  // (jimp, sharp) that we don't use for text-only sending, and bundling it
  // would force those to resolve at build time.
  serverExternalPackages: ["pdfkit", "@whiskeysockets/baileys"],
};

export default nextConfig;
