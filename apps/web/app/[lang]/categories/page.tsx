import { CategoriesShell } from "../../../src/components/categories-shell";
import type { Metadata } from "next";
import { buildPublicMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type CategoriesPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { lang } = await params;
  return <CategoriesShell language={lang} />;
}

export async function generateMetadata({ params }: CategoriesPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const translation = getDictionary(resolvedLanguage).categories;
  return buildPublicMetadata(resolvedLanguage, "/categories", translation.metaTitle, translation.metaDescription);
}
