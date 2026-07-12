"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ListingCard } from "./listing-card";

type FavoritesShellProps = {
  language: string;
};

const FAVORITES_STORAGE_KEY = "sanany:favorites";

export function FavoritesShell({ language }: FavoritesShellProps) {
  const { t } = useTranslation();
  const repository = useMemo(() => getWebListingsRepository(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<MarketplaceListing[]>([]);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const run = async () => {
      try {
        const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
        const ids = raw ? (JSON.parse(raw) as string[]) : [];
        if (!ids.length) {
          if (active) {
            setItems([]);
            setIsLoading(false);
          }
          return;
        }

        const listings = await Promise.all(ids.map((id) => repository.getById(id)));
        if (active) {
          setItems(listings.filter((item): item is MarketplaceListing => item !== null));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [repository]);

  const removeFavorite = (id: string) => {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    const nextIds = ids.filter((item) => item !== id);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextIds));
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("favorites.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("favorites.pageSubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <AppNavigation language={resolvedLanguage} />

        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}

        {!isLoading && items.length === 0 ? (
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">{t("favorites.emptyTitle")}</h2>
            <p className="text-sm text-slate-600">{t("favorites.emptyHint")}</p>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((listing) => (
            <div key={listing.id} className="space-y-2">
              <ListingCard listing={listing} language={resolvedLanguage} />
              <button
                type="button"
                onClick={() => removeFavorite(listing.id)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
              >
                {t("marketplace.favorite.remove")}
              </button>
            </div>
          ))}
        </section>
      </main>
    </RequireAuth>
  );
}
