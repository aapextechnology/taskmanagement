import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server bundle — required by the Docker image (T-002).
  output: "standalone",
  // pdfkit loads its AFM font data from node_modules at runtime — keep it
  // external so the standalone tracer ships those files (report PDFs).
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
