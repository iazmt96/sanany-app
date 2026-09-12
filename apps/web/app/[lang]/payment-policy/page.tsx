import type { Metadata } from "next";
import { PolicyPageShell } from "../../../src/components/policy-page";
import { paymentPolicy } from "../../../src/content/policies";
import { buildPublicMetadata, resolveLanguage } from "../../../src/lib/metadata";

type PolicyPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function PaymentPolicyPage({ params }: PolicyPageProps) {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  return <PolicyPageShell language={language} document={paymentPolicy} />;
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { lang } = await params;
  const language = resolveLanguage(lang);
  const content = language === "en" ? paymentPolicy.en : paymentPolicy.ar;
  return buildPublicMetadata(language, "/payment-policy", content.metaTitle, content.metaDescription);
}
