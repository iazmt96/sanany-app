import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sanany/api", "@sanany/auth", "@sanany/shared", "@sanany/types", "@sanany/ui", "@sanany/utils"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lcwmjfbosjxrozubbrpc.supabase.co",
        pathname: "/storage/v1/object/public/**"
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  }
};

export default nextConfig;
