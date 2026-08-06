import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server bundle — required by the Docker image (T-002).
  output: "standalone",
};

export default nextConfig;
