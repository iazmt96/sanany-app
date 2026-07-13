import { SearchShell } from "../../../src/components/search-shell";
import type { Metadata } from "next";
import { buildPublicMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type SearchPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function SearchPage({ params }: SearchPageProps) {
  const { lang } = await params;
  return <SearchShell language={lang} />;
}

export async function generateMetadata({ params }: SearchPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPublicMetadata(resolvedLanguage, "/search", dictionary.search.pageTitle, dictionary.search.pageSubtitle);
}
