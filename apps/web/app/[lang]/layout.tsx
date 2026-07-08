import { ReactNode } from "react";
import { AppProviders } from "../../src/providers";
import { defaultLanguage, isSupportedLanguage, type AppLanguage } from "@sanany/utils";

type LangLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string }>;
};

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const { lang } = await params;
  const resolvedLanguage: AppLanguage = isSupportedLanguage(lang) ? lang : defaultLanguage;

  return <AppProviders language={resolvedLanguage}>{children}</AppProviders>;
}

