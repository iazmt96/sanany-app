import { ChatShell } from "../../../src/components/chat-shell";
import type { Metadata } from "next";
import { buildPrivateMetadata, getDictionary, resolveLanguage } from "../../../src/lib/metadata";

type ChatPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { lang } = await params;
  return <ChatShell language={lang} />;
}

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedLanguage = resolveLanguage(lang);
  const dictionary = getDictionary(resolvedLanguage);
  return buildPrivateMetadata(
    resolvedLanguage,
    "/chat",
    dictionary.chat.pageTitle,
    dictionary.chat.pageSubtitle
  );
}
