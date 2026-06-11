import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ['laconically-unimaged-davian.ngrok-free.dev'],
};

export default nextConfig;
