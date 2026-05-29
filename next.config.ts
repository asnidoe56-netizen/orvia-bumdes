import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "www.inovasigorut.online",
        "inovasigorut.online",
        "orvia-bumdes.vercel.app",
        "*.vercel.app",
      ],
    },
  },
};

export default nextConfig;
