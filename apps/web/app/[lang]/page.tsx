import { MarketplaceShell } from "../../src/components/marketplace-shell";
import type { Metadata } from "next";
import { buildPublicMetadata, getDictionary, resolveLanguage } from "../../src/lib/metadata";

type MarketplacePageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MarketplacePage({ params }: MarketplacePageProps) {
  const { lang } = await params;
  return <MarketplaceShell language={lang} />;
}

export async function generateMetadata({ params }: MarketplacePageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const translation = getDictionary(resolvedLanguage).home;
  return buildPublicMetadata(resolvedLanguage, "", translation.metaTitle, translation.metaDescription);
}
