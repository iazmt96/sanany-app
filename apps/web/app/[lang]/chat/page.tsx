import { ChatShell } from "../../../src/components/chat-shell";

type ChatPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { lang } = await params;
  return <ChatShell language={lang} />;
}
