import { AuthShell } from "../../../src/components/auth-shell";

type AuthPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function AuthPage({ params }: AuthPageProps) {
  const { lang } = await params;
  return <AuthShell language={lang} />;
}
