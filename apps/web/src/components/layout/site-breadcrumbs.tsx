"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";

type SiteBreadcrumbsProps = {
  language: string;
};

const ROUTE_LABEL_KEYS: Record<string, string> = {
  search: "nav.search",
  categories: "nav.categories",
  favorites: "nav.favorites",
  chat: "nav.chat",
  notifications: "nav.notifications",
  "my-ads": "nav.myAds",
  profile: "nav.profile",
  auth: "siteLayout.auth.signIn",
  listing: "siteLayout.breadcrumbs.listing",
  seller: "siteLayout.breadcrumbs.seller"
};

export function SiteBreadcrumbs({ language }: SiteBreadcrumbsProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return null;
  }

  const pathSegments = segments.slice(1);

  return (
    <nav aria-label={t("siteLayout.breadcrumbs.ariaLabel")} className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
      <Link href={`/${resolvedLanguage}`} className="rounded px-1 py-0.5 hover:bg-slate-100 hover:text-slate-700">
        {t("nav.marketplace")}
      </Link>
      {pathSegments.map((segment, index) => {
        const href = `/${resolvedLanguage}/${pathSegments.slice(0, index + 1).join("/")}`;
        const labelKey = ROUTE_LABEL_KEYS[segment];
        const label = labelKey ? t(labelKey) : segment;
        const isLast = index === pathSegments.length - 1;
        return (
          <span key={`${href}-${segment}`} className="inline-flex items-center gap-2">
            <span aria-hidden>/</span>
            {isLast ? (
              <span className="font-medium text-slate-700">{label}</span>
            ) : (
              <Link href={href} className="rounded px-1 py-0.5 hover:bg-slate-100 hover:text-slate-700">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

