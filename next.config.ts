import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators:false,
  serverExternalPackages: [
    "@prisma/client",
    "@sparticuz/chromium-min",
    "puppeteer-core",
  ],
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
