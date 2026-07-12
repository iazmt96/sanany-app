"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

type AppNavigationProps = {
  language: string;
};

export function AppNavigation({ language }: AppNavigationProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const items = [
    { href: `/${language}`, label: t("nav.marketplace") },
    { href: `/${language}/search`, label: t("nav.search") },
    { href: `/${language}/categories`, label: t("nav.categories") },
    { href: `/${language}/favorites`, label: t("nav.favorites") },
    { href: `/${language}/chat`, label: t("nav.chat") },
    { href: `/${language}/notifications`, label: t("nav.notifications") },
    { href: `/${language}/my-ads`, label: t("nav.myAds") },
    { href: `/${language}/profile`, label: t("nav.profile") }
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              isActive ? "bg-brand text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:border-brand/50 hover:text-brand"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
