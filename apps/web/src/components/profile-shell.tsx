"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";

type ProfileShellProps = {
  language: string;
};

export function ProfileShell({ language }: ProfileShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("profile.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("profile.pageSubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <AppNavigation language={resolvedLanguage} />

        <Card className="space-y-3">
          <p className="text-sm text-slate-500">{t("profile.emailLabel")}</p>
          <p className="text-lg font-semibold text-slate-900">{snapshot.user?.email ?? "-"}</p>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link href={`/${resolvedLanguage}/my-ads`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 transition hover:border-brand/40 hover:text-brand">
            {t("profile.actions.myAds")}
          </Link>
          <Link href={`/${resolvedLanguage}/favorites`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 transition hover:border-brand/40 hover:text-brand">
            {t("profile.actions.favorites")}
          </Link>
          <Link href={`/${resolvedLanguage}/notifications`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 transition hover:border-brand/40 hover:text-brand">
            {t("profile.actions.notifications")}
          </Link>
          <Link href={`/${resolvedLanguage}/chat`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 transition hover:border-brand/40 hover:text-brand">
            {t("profile.actions.chat")}
          </Link>
          <button type="button" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 text-start">
            {t("profile.actions.settings")}
          </button>
        </section>
      </main>
    </RequireAuth>
  );
}
