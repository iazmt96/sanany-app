import { NotificationsShell } from "../../../src/components/notifications-shell";
import type { Metadata } from "next";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type NotificationsPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { lang } = await params;
  return <NotificationsShell language={lang} />;
}

export async function generateMetadata({ params }: NotificationsPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/notifications",
    dictionary.notifications.pageTitle,
    dictionary.notifications.pageSubtitle
  );
}
