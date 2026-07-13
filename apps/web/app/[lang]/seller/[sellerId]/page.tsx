import { SellerProfileShell } from "../../../../src/components/seller-profile-shell";
import type { Metadata } from "next";
import { createClient } from "../../../../utils/supabase/server";
import { buildPublicMetadata, getDictionary, resolveLanguage } from "../../../../src/lib/metadata";
import { toSlug } from "../../../../src/lib/seo";

type SellerProfilePageProps = {
  params: Promise<{ lang: string; sellerId: string }>;
};

export default async function SellerProfilePage({ params }: SellerProfilePageProps) {
  const { lang, sellerId } = await params;
  return <SellerProfileShell language={lang} sellerId={sellerId} />;
}

export async function generateMetadata({ params }: SellerProfilePageProps): Promise<Metadata> {
  const { lang, sellerId } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name,bio")
    .eq("id", sellerId)
    .maybeSingle();

  const sellerName = data?.display_name?.trim() || dictionary.sellerProfile.pageTitle;
  const title = `${sellerName} | SANANY`;
  const description = data?.bio?.trim().slice(0, 180) || dictionary.sellerProfile.pageSubtitle;
  const slug = toSlug(sellerName);
  const suffix = slug.length > 0 ? `?slug=${encodeURIComponent(slug)}` : "";
  return buildPublicMetadata(resolvedLanguage, `/seller/${sellerId}${suffix}`, title, description);
}
