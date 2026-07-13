import { AuthShell } from "../../../src/components/auth-shell";
import type { Metadata } from "next";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type AuthPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function AuthPage({ params }: AuthPageProps) {
  const { lang } = await params;
  return <AuthShell language={lang} />;
}

export async function generateMetadata({ params }: AuthPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/auth",
    dictionary.siteLayout.auth.signIn,
    dictionary.auth.subtitle
  );
}
