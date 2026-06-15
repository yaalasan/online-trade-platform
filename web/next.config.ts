import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are stable in Next 15; keep body size sane for form posts.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
