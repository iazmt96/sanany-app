"use client";

import { PropsWithChildren } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { ResponsiveContainer } from "./responsive-container";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { SiteBreadcrumbs } from "./site-breadcrumbs";

type SiteLayoutShellProps = PropsWithChildren<{
  language: string;
}>;

export function SiteLayoutShell({ language, children }: SiteLayoutShellProps) {
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const pathname = usePathname();
  const { t } = useTranslation();
  const isAuthPage = pathname.endsWith("/auth");
  const showSidebar = pathname.includes("/search") || pathname.includes("/categories") || pathname.includes("/profile");

  const sidebarLinks = [
    { href: `/${resolvedLanguage}`, label: t("nav.marketplace") },
    { href: `/${resolvedLanguage}/search`, label: t("nav.search") },
    { href: `/${resolvedLanguage}/categories`, label: t("nav.categories") },
    { href: `/${resolvedLanguage}/my-ads`, label: t("nav.myAds") },
    { href: `/${resolvedLanguage}/favorites`, label: t("nav.favorites") }
  ];

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main id="main-content" tabIndex={-1} className="min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader language={resolvedLanguage} />

      <ResponsiveContainer className="py-4 sm:py-5">
        <SiteBreadcrumbs language={resolvedLanguage} />

        <div className={`mt-3 grid gap-4 ${showSidebar ? "xl:grid-cols-[260px_minmax(0,1fr)]" : ""}`}>
          {showSidebar ? (
            <aside className="hidden h-fit rounded-xl border border-slate-200 bg-white p-3 xl:block" aria-label={t("siteLayout.sidebar.ariaLabel")}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("siteLayout.sidebar.title")}</p>
              <nav className="space-y-1">
                {sidebarLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-brand">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>
          ) : null}

          <main id="main-content" tabIndex={-1} className="min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
            {children}
          </main>
        </div>
      </ResponsiveContainer>

      <SiteFooter language={resolvedLanguage} />
    </div>
  );
}
