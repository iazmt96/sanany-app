import { MarketplaceShell } from "../../src/components/marketplace-shell";

type MarketplacePageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MarketplacePage({ params }: MarketplacePageProps) {
  const { lang } = await params;
  return <MarketplaceShell language={lang} />;
}
