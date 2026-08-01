import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.10",
    "localhost",
    "127.0.0.1",
    "trained-kathy-designated-services.trycloudflare.com",
  ],
};

export default nextConfig;