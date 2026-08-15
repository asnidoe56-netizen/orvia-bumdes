import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Foto pengurus diunggah lewat Server Action; batas bawaan 1MB terlalu
      // kecil untuk foto kamera ponsel. Batas per berkas tetap 4MB di action.
      bodySizeLimit: "5mb",
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
