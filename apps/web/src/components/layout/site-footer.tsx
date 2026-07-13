"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { LanguageSwitcher } from "../language-switcher";
import { ResponsiveContainer } from "./responsive-container";

type SiteFooterProps = {
  language: string;
};

export function SiteFooter({ language }: SiteFooterProps) {
  const { t } = useTranslation();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const year = new Date().getFullYear();

  const infoLinks = [
    { href: `/${resolvedLanguage}`, label: t("siteLayout.footer.about") },
    { href: `/${resolvedLanguage}`, label: t("siteLayout.footer.terms") },
    { href: `/${resolvedLanguage}`, label: t("siteLayout.footer.privacy") },
    { href: `/${resolvedLanguage}`, label: t("siteLayout.footer.help") },
    { href: `/${resolvedLanguage}`, label: t("siteLayout.footer.contact") }
  ];

  return (
    <footer className="mt-10 border-t border-slate-200 bg-white">
      <ResponsiveContainer className="py-8">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr_1fr]">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">{t("app.title")}</h2>
            <p className="max-w-prose text-sm text-slate-600">{t("siteLayout.footer.aboutDescription")}</p>
            <p className="text-xs text-slate-500">{t("siteLayout.footer.copyright", { year })}</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{t("siteLayout.footer.linksTitle")}</h3>
            <ul className="space-y-2">
              {infoLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-slate-600 hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{t("siteLayout.footer.appsTitle")}</h3>
            <div className="space-y-2">
              <Link href={`/${resolvedLanguage}`} className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand/40 hover:text-brand">
                {t("siteLayout.footer.ios")}
              </Link>
              <Link href={`/${resolvedLanguage}`} className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand/40 hover:text-brand">
                {t("siteLayout.footer.android")}
              </Link>
            </div>
            <div className="pt-1">
              <p className="mb-2 text-xs font-semibold text-slate-500">{t("siteLayout.footer.languageTitle")}</p>
              <LanguageSwitcher />
            </div>
          </section>
        </div>
      </ResponsiveContainer>
    </footer>
  );
}

