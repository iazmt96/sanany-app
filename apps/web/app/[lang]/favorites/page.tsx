import { FavoritesShell } from "../../../src/components/favorites-shell";

type FavoritesPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { lang } = await params;
  return <FavoritesShell language={lang} />;
}
