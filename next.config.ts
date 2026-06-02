import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable minimal server output for container images
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [new URL("https://minotar.net/**")],
  }
};

export default nextConfig;
