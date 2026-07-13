import { ProfileShell } from "../../../src/components/profile-shell";
import type { Metadata } from "next";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type ProfilePageProps = {
  params: Promise<{ lang: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { lang } = await params;
  return <ProfileShell language={lang} />;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/profile",
    dictionary.profile.pageTitle,
    dictionary.profile.pageSubtitle
  );
}
