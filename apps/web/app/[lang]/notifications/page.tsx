import { NotificationsShell } from "../../../src/components/notifications-shell";

type NotificationsPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { lang } = await params;
  return <NotificationsShell language={lang} />;
}
