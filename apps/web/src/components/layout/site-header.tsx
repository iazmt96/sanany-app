"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isAuthenticated } from "@sanany/auth";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../../auth/auth-context";
import { LanguageSwitcher } from "../language-switcher";
import { NotificationsDropdown } from "./notifications-dropdown";
import { ResponsiveContainer } from "./responsive-container";

type SiteHeaderProps = {
  language: string;
};

const CITY_KEYS = ["riyadh", "jeddah", "dammam", "makkah", "madinah"] as const;

export function SiteHeader({ language }: SiteHeaderProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { snapshot } = useAuth();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const [searchText, setSearchText] = useState("");
  const [city, setCity] = useState<(typeof CITY_KEYS)[number]>("riyadh");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuId = "sanany-mobile-menu";
  const isLoggedIn = isAuthenticated(snapshot);
  const addListingHref = isLoggedIn ? `/${resolvedLanguage}/my-ads` : `/${resolvedLanguage}/auth`;

  const navItems = useMemo(
    () => [
      { href: `/${resolvedLanguage}`, label: t("nav.marketplace") },
      { href: `/${resolvedLanguage}/search`, label: t("nav.search") },
      { href: `/${resolvedLanguage}/categories`, label: t("nav.categories") }
    ],
    [resolvedLanguage, t]
  );

  const utilityItems = useMemo(
    () => [
      { href: `/${resolvedLanguage}/favorites`, label: t("nav.favorites") },
      { href: `/${resolvedLanguage}/chat`, label: t("nav.chat") },
      { href: `/${resolvedLanguage}/notifications`, label: t("nav.notifications") },
      { href: `/${resolvedLanguage}/profile`, label: t("nav.profile") }
    ],
    [resolvedLanguage, t]
  );

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchText.trim();
    const searchParams = new URLSearchParams();
    if (query.length > 0) {
      searchParams.set("q", query);
    }
    searchParams.set("city", city);
    const suffix = searchParams.toString();
    router.push(`/${resolvedLanguage}/search${suffix.length > 0 ? `?${suffix}` : ""}`);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <a href="#main-content" className="skip-link">
        {t("siteLayout.skipToContent")}
      </a>
      <ResponsiveContainer className="py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
              onClick={() => setIsMobileMenuOpen((value) => !value)}
              aria-expanded={isMobileMenuOpen}
              aria-controls={mobileMenuId}
              aria-label={t("siteLayout.mobileMenu.open")}
            >
              <span aria-hidden>☰</span>
            </button>
            <Link href={`/${resolvedLanguage}`} className="inline-flex items-center gap-2 rounded-md px-1 py-1">
              <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-8 w-auto sm:h-9" priority />
              <span className="hidden text-base font-bold text-slate-900 sm:inline">{t("app.title")}</span>
            </Link>
          </div>

          <form onSubmit={onSearchSubmit} className="hidden flex-1 items-center gap-2 md:flex">
            <label htmlFor="sanany-header-search" className="sr-only">
              {t("siteLayout.header.searchLabel")}
            </label>
            <input
              id="sanany-header-search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("siteLayout.header.searchPlaceholder")}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 transition focus:border-brand focus:ring"
            />
            <label htmlFor="sanany-header-city" className="sr-only">
              {t("siteLayout.header.cityLabel")}
            </label>
            <select
              id="sanany-header-city"
              value={city}
              onChange={(event) => setCity(event.target.value as (typeof CITY_KEYS)[number])}
              className="h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 transition focus:border-brand focus:ring"
            >
              {CITY_KEYS.map((cityKey) => (
                <option key={cityKey} value={cityKey}>
                  {t(`siteLayout.cities.${cityKey}`)}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark">
              {t("nav.search")}
            </button>
          </form>

          <div className="hidden items-center gap-2 lg:flex">
            {utilityItems
              .filter((item) => !item.href.endsWith("/notifications"))
              .map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
                    active ? "bg-slate-100 text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {!isLoggedIn ? (
              <Link href={`/${resolvedLanguage}/notifications`} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
                {t("nav.notifications")}
              </Link>
            ) : null}
            {isLoggedIn ? <NotificationsDropdown language={resolvedLanguage} /> : null}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <Link href={addListingHref} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
              {t("siteLayout.header.addListing")}
            </Link>
            {isLoggedIn ? (
              <Link href={`/${resolvedLanguage}/profile`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("nav.profile")}
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href={`/${resolvedLanguage}/auth`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {t("siteLayout.auth.signIn")}
                </Link>
                <Link href={`/${resolvedLanguage}/auth`} className="rounded-lg border border-brand bg-brand/5 px-3 py-2 text-sm font-semibold text-brand hover:bg-brand/10">
                  {t("siteLayout.auth.signUp")}
                </Link>
              </div>
            )}
          </div>
        </div>

        <nav className="mt-3 hidden items-center gap-2 border-t border-slate-100 pt-3 md:flex" aria-label={t("siteLayout.header.mainNavigationAriaLabel")}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-brand/40 hover:text-brand"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ResponsiveContainer>

      <div
        id={mobileMenuId}
        className={`fixed inset-x-0 top-[72px] z-50 border-b border-slate-200 bg-white p-4 shadow-xl transition md:hidden ${
          isMobileMenuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        <form onSubmit={onSearchSubmit} className="space-y-2">
          <label htmlFor="sanany-header-search-mobile" className="sr-only">
            {t("siteLayout.header.searchLabel")}
          </label>
          <input
            id="sanany-header-search-mobile"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={t("siteLayout.header.searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 transition focus:border-brand focus:ring"
          />
          <label htmlFor="sanany-header-city-mobile" className="sr-only">
            {t("siteLayout.header.cityLabel")}
          </label>
          <select
            id="sanany-header-city-mobile"
            value={city}
            onChange={(event) => setCity(event.target.value as (typeof CITY_KEYS)[number])}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 transition focus:border-brand focus:ring"
          >
            {CITY_KEYS.map((cityKey) => (
              <option key={cityKey} value={cityKey}>
                {t(`siteLayout.cities.${cityKey}`)}
              </option>
            ))}
          </select>
          <button type="submit" className="h-10 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark">
            {t("nav.search")}
          </button>
        </form>

        <nav className="mt-4 grid grid-cols-2 gap-2" aria-label={t("siteLayout.mobileMenu.ariaLabel")}>
          {[...navItems, ...utilityItems].map((item) => (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand/40 hover:text-brand"
            >
              {item.label}
            </Link>
          ))}
          <Link href={addListingHref} onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white">
            {t("siteLayout.header.addListing")}
          </Link>
          {!isLoggedIn ? (
            <>
              <Link
                href={`/${resolvedLanguage}/auth`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700"
              >
                {t("siteLayout.auth.signIn")}
              </Link>
              <Link
                href={`/${resolvedLanguage}/auth`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg border border-brand bg-brand/5 px-3 py-2 text-center text-sm font-semibold text-brand"
              >
                {t("siteLayout.auth.signUp")}
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
