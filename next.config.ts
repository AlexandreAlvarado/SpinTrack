import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  logging: { incomingRequests: { ignore: [/\/auth\/(recovery|callback)(\?|$)/] } },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

