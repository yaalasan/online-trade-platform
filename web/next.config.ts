import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are stable in Next 15. Raised to allow factory-photo /
    // certificate uploads through the media server action.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
