import { FavoritesShell } from "../../../src/components/favorites-shell";
import type { Metadata } from "next";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type FavoritesPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { lang } = await params;
  return <FavoritesShell language={lang} />;
}

export async function generateMetadata({ params }: FavoritesPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/favorites",
    dictionary.favorites.pageTitle,
    dictionary.favorites.pageSubtitle
  );
}
