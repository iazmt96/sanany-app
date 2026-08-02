import { ListingDetailsShell } from "../../../../src/components/listing-details-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "../../../../utils/supabase/server";
import { buildAlternates, toSlug } from "../../../../src/lib/seo";
import { getDictionary, resolveLanguage } from "../../../../src/lib/metadata";

type ListingDetailsPageProps = {
  params: Promise<{ lang: string; id: string }>;
};

export default async function ListingDetailsPage({ params }: ListingDetailsPageProps) {
  const { lang, id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").select("id").eq("id", id).maybeSingle();
  if (!error && !data) {
    notFound();
  }
  return <ListingDetailsShell language={lang} listingId={id} />;
}

export async function generateMetadata({ params }: ListingDetailsPageProps): Promise<Metadata> {
  const { lang, id } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id,title,description,image_url")
    .eq("id", id)
    .maybeSingle();

  const title = data?.title ? `${data.title} | SANANY` : dictionary.marketplace.detail.pageTitle;
  const description = data?.description?.slice(0, 180) ?? dictionary.marketplace.detail.description;
  const image = typeof data?.image_url === "string" && data.image_url.length > 0 ? data.image_url : "/brand/sanany-logo.png";
  const slug = data?.title ? toSlug(data.title) : "";
  const suffix = slug.length > 0 ? `?slug=${encodeURIComponent(slug)}` : "";
  const canonicalPath = `/listing/${id}${suffix}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${resolvedLanguage}${canonicalPath}`,
      languages: buildAlternates(canonicalPath)
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/${resolvedLanguage}${canonicalPath}`,
      images: [{ url: image }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}
