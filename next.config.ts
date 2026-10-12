import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Prisma roda como pacote externo no servidor (o engine binário não pode ser empacotado) */
  serverExternalPackages: ["@prisma/client"],
  /* Inclui o banco SQLite empacotado nas funções serverless (Vercel):
     o db.ts copia este arquivo para /tmp no cold start. */
  outputFileTracingIncludes: {
    "/api/**": ["./db/custom.db"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
