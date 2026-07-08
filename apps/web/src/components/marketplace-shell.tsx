"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { ListingFilterStatus, ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";
import { Badge, Button, Card, TextInput } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { LanguageSwitcher } from "./language-switcher";

type MarketplaceShellProps = {
  language: string;
};

const PAGE_SIZE = 6;

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

export function MarketplaceShell({ language }: MarketplaceShellProps) {
  const { t } = useTranslation();
  const { snapshot, signOut } = useAuth();
  const listingsRepository = useMemo(() => getWebListingsRepository(), []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingFilterStatus>("all");
  const [sort, setSort] = useState<"newest" | "priceHigh" | "priceLow">("newest");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishFormOpen, setIsPublishFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [data, setData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });

  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  const publishListing = useCallback(async () => {
    setPublishError(null);
    setPublishSuccess(null);

    if (!snapshot.user?.id) {
      setPublishError(t("marketplace.create.errors.authRequired"));
      return;
    }

    if (!listingTitle.trim()) {
      setPublishError(t("marketplace.create.errors.titleRequired"));
      return;
    }

    const parsedPrice = Number(listingPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setPublishError(t("marketplace.create.errors.priceInvalid"));
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: listingTitle.trim(),
          description: listingDescription.trim(),
          price: parsedPrice
        })
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? t("marketplace.loadError"));
      }

      setListingTitle("");
      setListingDescription("");
      setListingPrice("");
      setPage(1);
      setRefreshToken((value) => value + 1);
      setPublishSuccess(t("marketplace.create.success"));
    } catch (publishRequestError) {
      setPublishError(publishRequestError instanceof Error ? publishRequestError.message : t("marketplace.loadError"));
    } finally {
      setIsPublishing(false);
    }
  }, [listingDescription, listingPrice, listingTitle, snapshot.user?.id, t]);

  useEffect(() => {
    const query: ListingsQuery = {
      page,
      pageSize: PAGE_SIZE,
      search,
      status: statusFilter,
      sort
    };

    let active = true;
    setIsLoading(true);
    setError(null);

    void listingsRepository
      .list(query)
      .then((result) => {
        if (active) {
          setData(result);
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
  }, [listingsRepository, page, refreshToken, search, sort, statusFilter, t]);

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("marketplace.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("marketplace.pageSubtitle")}</p>
            {snapshot.user?.email ? (
              <p className="text-xs text-slate-500">{t("marketplace.signOutHint", { email: snapshot.user.email })}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button type="button" onClick={() => setIsPublishFormOpen((value) => !value)}>
              {isPublishFormOpen ? t("marketplace.create.close") : t("marketplace.create.open")}
            </Button>
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => {
                void signOut();
              }}
            >
              {t("common.signOut")}
            </button>
          </div>
        </header>

        {isPublishFormOpen ? (
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t("marketplace.create.title")}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">{t("marketplace.create.listingTitleLabel")}</span>
                <TextInput
                  value={listingTitle}
                  onChange={(event) => setListingTitle(event.target.value)}
                  placeholder={t("marketplace.create.listingTitlePlaceholder")}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">{t("marketplace.create.listingPriceLabel")}</span>
                <TextInput
                  type="number"
                  value={listingPrice}
                  onChange={(event) => setListingPrice(event.target.value)}
                  placeholder={t("marketplace.create.listingPricePlaceholder")}
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">{t("marketplace.create.listingDescriptionLabel")}</span>
              <textarea
                value={listingDescription}
                onChange={(event) => setListingDescription(event.target.value)}
                placeholder={t("marketplace.create.listingDescriptionPlaceholder")}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
              />
            </label>
            {publishError ? <p className="text-sm text-red-600">{publishError}</p> : null}
            {publishSuccess ? <p className="text-sm text-emerald-700">{publishSuccess}</p> : null}
            <Button type="button" onClick={() => void publishListing()} disabled={isPublishing}>
              {isPublishing ? t("common.loading") : t("marketplace.create.submit")}
            </Button>
          </Card>
        ) : null}

        <section className="sticky top-0 z-10 grid gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 backdrop-blur md:grid-cols-[1fr_220px_180px]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("marketplace.searchPlaceholder")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
          />
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "newest" | "priceHigh" | "priceLow");
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
          >
            <option value="newest">{t("marketplace.sort.newest")}</option>
            <option value="priceHigh">{t("marketplace.sort.priceHigh")}</option>
            <option value="priceLow">{t("marketplace.sort.priceLow")}</option>
          </select>
          <p className="text-sm font-medium text-slate-700">{t("marketplace.sort.label")}</p>
        </section>

        <section className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              statusFilter === "all" ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {t("marketplace.filters.all")}
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("available");
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              statusFilter === "available" ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {t("marketplace.filters.available")}
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("reserved");
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              statusFilter === "reserved" ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {t("marketplace.filters.reserved")}
          </button>
        </section>

        {error ? (
          <Card className="space-y-3">
            <p className="text-sm text-red-600">{t("marketplace.loadError")}</p>
            <p className="text-xs text-slate-500">{error}</p>
          </Card>
        ) : null}

        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}

        {!isLoading && data.items.length === 0 ? <p className="text-sm text-slate-600">{t("marketplace.emptyState")}</p> : null}

        <p className="text-sm font-medium text-slate-700">{t("marketplace.listCount", { count: data.totalItems })}</p>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((listing) => (
            <Link key={listing.id} href={`/${resolvedLanguage}/listing/${listing.id}`} className="block">
              <Card className="space-y-3 transition hover:border-brand hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{listing.title}</h2>
                <Badge variant={listing.status}>{t(`marketplace.status.${listing.status}`)}</Badge>
              </div>
              {listing.description ? (
                <p className="text-sm text-slate-600">{listing.description}</p>
              ) : null}
              <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
                <span>{t("marketplace.postedAt", { value: formatRelativeTime(listing.createdAt, resolvedLanguage) })}</span>
                <span>{t("marketplace.pricePerDay", { value: listing.price })}</span>
              </div>
              </Card>
            </Link>
          ))}
        </section>

        <footer className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || isLoading}
          >
            {t("common.previous")}
          </button>
          <p className="text-sm text-slate-600">{t("common.page", { current: data.page, total: data.totalPages })}</p>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}
            disabled={page >= data.totalPages || isLoading}
          >
            {t("common.next")}
          </button>
        </footer>
      </main>
    </RequireAuth>
  );
}
