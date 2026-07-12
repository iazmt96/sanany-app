"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { RequireAuth } from "../auth/guards";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";

type NotificationsShellProps = {
  language: string;
};

export function NotificationsShell({ language }: NotificationsShellProps) {
  const { t } = useTranslation();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("notifications.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("notifications.pageSubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <AppNavigation language={resolvedLanguage} />

        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{t("notifications.emptyTitle")}</h2>
          <p className="text-sm text-slate-600">{t("notifications.emptyHint")}</p>
        </Card>
      </main>
    </RequireAuth>
  );
}
