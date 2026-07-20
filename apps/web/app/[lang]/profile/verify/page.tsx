import type { Metadata } from "next";
import { AccountVerificationShell } from "../../../../src/components/account-verification-shell";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../../src/lib/metadata";

type ProfileVerifyPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function ProfileVerifyPage({ params }: ProfileVerifyPageProps) {
  const { lang } = await params;
  return <AccountVerificationShell language={lang} />;
}

export async function generateMetadata({ params }: ProfileVerifyPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/profile/verify",
    dictionary.profile.verificationFlow.title,
    dictionary.profile.verificationFlow.subtitle
  );
}
