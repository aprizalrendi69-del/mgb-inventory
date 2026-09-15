import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hilangkan indikator "N" Next.js di kiri bawah
  devIndicators: false,

  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;