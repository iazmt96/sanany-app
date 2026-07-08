"use client";

import { useTranslation } from "react-i18next";
import { marketplaceSeedListings } from "@sanany/shared";
import { Badge, Card } from "@sanany/ui";
import { LanguageSwitcher } from "./language-switcher";

export function MarketplaceShell() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{t("marketplace.pageTitle")}</h1>
          <p className="text-sm text-slate-600">{t("marketplace.pageSubtitle")}</p>
        </div>
        <LanguageSwitcher />
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {marketplaceSeedListings.map((listing) => (
          <Card key={listing.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{t(listing.titleKey)}</h2>
              <Badge>{t(`marketplace.status.${listing.status}`)}</Badge>
            </div>
            <p className="text-sm text-slate-600">{t(listing.summaryKey)}</p>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{t(listing.locationKey)}</span>
              <span>{t("marketplace.pricePerDay", { value: listing.dailyPrice })}</span>
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
}

