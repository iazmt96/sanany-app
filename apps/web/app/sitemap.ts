import type { MetadataRoute } from "next";
import { createClient } from "../utils/supabase/server";
import { absoluteUrl, localizedPath, toSlug } from "../src/lib/seo";

const PUBLIC_STATIC_PATHS = ["", "/search", "/categories"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const language of ["ar", "en"] as const) {
    for (const path of PUBLIC_STATIC_PATHS) {
      entries.push({
        url: absoluteUrl(localizedPath(language, path)),
        lastModified: now,
        changeFrequency: path === "" ? "daily" : "hourly",
        priority: path === "" ? 1 : 0.8
      });
    }
  }

  const supabase = await createClient();
  const [listingsResult, sellersResult] = await Promise.all([
    supabase.from("listings").select("id,title,created_at").in("status", ["available", "reserved"]).order("created_at", { ascending: false }).limit(1500),
    supabase.from("profiles").select("id,display_name,updated_at").order("updated_at", { ascending: false }).limit(1000)
  ]);

  const listings = listingsResult.data ?? [];
  const sellers = sellersResult.data ?? [];

  for (const language of ["ar", "en"] as const) {
    for (const listing of listings) {
      const slug = listing.title ? toSlug(listing.title) : "";
      const listingPath = slug.length > 0 ? localizedPath(language, `/listing/${listing.id}?slug=${encodeURIComponent(slug)}`) : localizedPath(language, `/listing/${listing.id}`);
      entries.push({
        url: absoluteUrl(listingPath),
        lastModified: listing.created_at ? new Date(listing.created_at) : now,
        changeFrequency: "hourly",
        priority: 0.9
      });
    }

    for (const seller of sellers) {
      const slug = seller.display_name ? toSlug(seller.display_name) : "";
      const sellerPath = slug.length > 0 ? localizedPath(language, `/seller/${seller.id}?slug=${encodeURIComponent(slug)}`) : localizedPath(language, `/seller/${seller.id}`);
      entries.push({
        url: absoluteUrl(sellerPath),
        lastModified: seller.updated_at ? new Date(seller.updated_at) : now,
        changeFrequency: "daily",
        priority: 0.7
      });
    }
  }

  return entries;
}
