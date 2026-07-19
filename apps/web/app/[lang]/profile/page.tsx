import { ProfileShell } from "../../../src/components/profile-shell";
import type { Metadata } from "next";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type ProfilePageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ tab?: string; tap_id?: string; tapId?: string; listingId?: string }>;
};

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { lang } = await params;
  const sp = searchParams ? await searchParams : {};
  const tab = sp.tab ?? null;
  const tapId = sp.tap_id ?? sp.tapId ?? null;
  const tapListingId = sp.listingId ?? null;
  return (
    <ProfileShell
      language={lang}
      tab={tab}
      tapPaymentReturn={tapId && tapListingId ? { tapId, listingId: tapListingId } : null}
    />
  );
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
