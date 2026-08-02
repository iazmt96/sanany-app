import { ReactNode } from "react";
import { AppProviders } from "../../src/providers";
import { SiteLayoutShell } from "../../src/components/layout/site-layout-shell";
import { defaultLanguage, isSupportedLanguage, type AppLanguage } from "@sanany/utils";

type LangLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string }>;
};

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const { lang } = await params;
  const resolvedLanguage: AppLanguage = isSupportedLanguage(lang) ? lang : defaultLanguage;

  return (
    <AppProviders language={resolvedLanguage}>
      <SiteLayoutShell language={resolvedLanguage}>{children}</SiteLayoutShell>
    </AppProviders>
  );
}
