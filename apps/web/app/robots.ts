import type { MetadataRoute } from "next";
import { getSiteUrl } from "../src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ar", "/en", "/ar/search", "/en/search", "/ar/categories", "/en/categories", "/ar/listing", "/en/listing", "/ar/seller", "/en/seller"],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/auth/",
          "/ar/auth",
          "/en/auth",
          "/ar/profile",
          "/en/profile",
          "/ar/my-ads",
          "/en/my-ads",
          "/ar/favorites",
          "/en/favorites",
          "/ar/chat",
          "/en/chat",
          "/ar/notifications",
          "/en/notifications"
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
