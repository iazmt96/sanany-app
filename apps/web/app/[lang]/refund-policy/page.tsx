import type { Metadata } from "next";
import { PolicyPageShell } from "../../../src/components/policy-page";
import { refundPolicy } from "../../../src/content/policies";
import { buildPublicMetadata, resolveLanguage } from "../../../src/lib/metadata";

type PolicyPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function RefundPolicyPage({ params }: PolicyPageProps) {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  return <PolicyPageShell language={language} document={refundPolicy} />;
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  const content = language === "en" ? refundPolicy.en : refundPolicy.ar;
  return buildPublicMetadata(language, "/refund-policy", content.metaTitle, content.metaDescription);
}
