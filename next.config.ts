import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  logging: { incomingRequests: { ignore: [/\/auth\/(recovery|callback)(\?|$)/] } },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

