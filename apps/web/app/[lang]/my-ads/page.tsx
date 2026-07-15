import { MyAdsShell } from "../../../src/components/my-ads-shell";
import type { Metadata } from "next";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type MyAdsPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ previewState?: string }>;
};

export default async function MyAdsPage({ params, searchParams }: MyAdsPageProps) {
  const { lang } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return <MyAdsShell language={lang} previewState={resolvedSearchParams?.previewState ?? null} />;
}

export async function generateMetadata({ params }: MyAdsPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/my-ads",
    dictionary.myAds.pageTitle,
    dictionary.myAds.pageSubtitle
  );
}
