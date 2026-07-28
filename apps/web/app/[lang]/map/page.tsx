import { MapPageShell } from "../../../src/components/map-page-shell";
import type { Metadata } from "next";
import { buildPublicMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type MapPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MapPage({ params }: MapPageProps) {
  const { lang } = await params;
  return <MapPageShell language={lang} />;
}

export async function generateMetadata({ params }: MapPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPublicMetadata(
    resolvedLanguage,
    "/map",
    dictionary.home.mapScreen.title,
    dictionary.home.mapScreen.locating
  );
}
