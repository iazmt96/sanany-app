import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sanany/api", "@sanany/shared", "@sanany/types", "@sanany/ui", "@sanany/utils"]
};

export default nextConfig;

