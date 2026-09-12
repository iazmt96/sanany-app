import type { Metadata } from "next";
import { PolicyPageShell } from "../../../src/components/policy-page";
import { listingPolicy } from "../../../src/content/policies";
import { buildPublicMetadata, resolveLanguage } from "../../../src/lib/metadata";

type PolicyPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function ListingPolicyPage({ params }: PolicyPageProps) {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  return <PolicyPageShell language={language} document={listingPolicy} />;
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  const content = language === "en" ? listingPolicy.en : listingPolicy.ar;
  return buildPublicMetadata(language, "/listing-policy", content.metaTitle, content.metaDescription);
}
