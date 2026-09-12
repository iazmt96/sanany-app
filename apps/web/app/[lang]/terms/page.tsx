import type { Metadata } from "next";
import { PolicyPageShell } from "../../../src/components/policy-page";
import { termsPolicy } from "../../../src/content/policies";
import { buildPublicMetadata, resolveLanguage } from "../../../src/lib/metadata";

type PolicyPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function TermsPage({ params }: PolicyPageProps) {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  return <PolicyPageShell language={language} document={termsPolicy} />;
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  const content = language === "en" ? termsPolicy.en : termsPolicy.ar;
  return buildPublicMetadata(language, "/terms", content.metaTitle, content.metaDescription);
}
