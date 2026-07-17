import type { Metadata } from "next";
import { ProfileEditShell } from "../../../../src/components/profile-edit-shell";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../../src/lib/metadata";

type ProfileEditPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function ProfileEditPage({ params }: ProfileEditPageProps) {
  const { lang } = await params;
  return <ProfileEditShell language={lang} />;
}

export async function generateMetadata({ params }: ProfileEditPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/profile/edit",
    dictionary.profile.edit.title,
    dictionary.profile.dashboard.editPageSubtitle
  );
}
