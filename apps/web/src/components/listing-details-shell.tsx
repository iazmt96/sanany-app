"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import { Badge, Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";

type ListingDetailsShellProps = {
  language: string;
  listingId: string;
};

function formatRelativeTime(value: string, language: string): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const absMinutes = Math.abs(diffMinutes);
  const locale = language === "ar" ? "ar" : "en";
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absMinutes < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

export function ListingDetailsShell({ language, listingId }: ListingDetailsShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const repository = useMemo(() => getWebListingsRepository(), []);
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    void repository
      .getById(listingId)
      .then((result) => {
        if (active) {
          setListing(result);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("marketplace.loadError"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listingId, repository, t]);

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-xl font-bold text-slate-900">{t("marketplace.detail.pageTitle")}</h1>
          </div>
          <Link href={`/${resolvedLanguage}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            {t("marketplace.detail.back")}
          </Link>
        </header>

        {snapshot.user?.email ? <p className="text-xs text-slate-500">{t("marketplace.signOutHint", { email: snapshot.user.email })}</p> : null}

        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}

        {error ? (
          <Card className="space-y-3">
            <p className="text-sm text-red-600">{t("marketplace.loadError")}</p>
            <p className="text-xs text-slate-500">{error}</p>
          </Card>
        ) : null}

        {!isLoading && !error && !listing ? <p className="text-sm text-slate-600">{t("marketplace.detail.notFound")}</p> : null}

        {listing ? (
          <Card className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">{listing.title}</h2>
                <p className="text-sm text-slate-500">{t("marketplace.postedAt", { value: formatRelativeTime(listing.createdAt, resolvedLanguage) })}</p>
              </div>
              <Badge variant={listing.status}>{t(`marketplace.status.${listing.status}`)}</Badge>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 text-lg font-semibold text-slate-900">{t("marketplace.pricePerDay", { value: listing.price })}</div>

            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">{t("marketplace.detail.description")}</h3>
              <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{listing.description ?? t("marketplace.detail.noDescription")}</p>
            </section>
          </Card>
        ) : null}
      </main>
    </RequireAuth>
  );
}

