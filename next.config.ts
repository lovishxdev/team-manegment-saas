import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    serverActions: {
      // Asset uploads go through a server action; default limit is 1 MB.
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ['laconically-unimaged-davian.ngrok-free.dev'],
};

export default nextConfig;
