import type { Metadata } from "next";
import { PolicyPageShell } from "../../../src/components/policy-page";
import { privacyPolicy } from "../../../src/content/policies";
import { buildPublicMetadata, resolveLanguage } from "../../../src/lib/metadata";

type PolicyPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function PrivacyPage({ params }: PolicyPageProps) {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  return <PolicyPageShell language={language} document={privacyPolicy} />;
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  const content = language === "en" ? privacyPolicy.en : privacyPolicy.ar;
  return buildPublicMetadata(language, "/privacy", content.metaTitle, content.metaDescription);
}
