"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { ListingFilterStatus, ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";
import { Badge, Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { LanguageSwitcher } from "./language-switcher";

type MarketplaceShellProps = {
  language: string;
};

const PAGE_SIZE = 6;

export function MarketplaceShell({ language }: MarketplaceShellProps) {
  const { t } = useTranslation();
  const { snapshot, signOut } = useAuth();
  const listingsRepository = useMemo(() => getWebListingsRepository(), []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingFilterStatus>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });

  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  useEffect(() => {
    const query: ListingsQuery = {
      page,
      pageSize: PAGE_SIZE,
      search,
      status: statusFilter
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
  }, [listingsRepository, page, search, statusFilter, t]);

  return (
    <RequireAuth language={resolvedLanguage}>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
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

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px]">
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
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as ListingFilterStatus);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
          >
            <option value="all">{t("marketplace.filters.all")}</option>
            <option value="available">{t("marketplace.filters.available")}</option>
            <option value="reserved">{t("marketplace.filters.reserved")}</option>
          </select>
        </section>

        {error ? (
          <Card className="space-y-3">
            <p className="text-sm text-red-600">{t("marketplace.loadError")}</p>
            <p className="text-xs text-slate-500">{error}</p>
          </Card>
        ) : null}

        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}

        {!isLoading && data.items.length === 0 ? <p className="text-sm text-slate-600">{t("marketplace.emptyState")}</p> : null}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((listing) => (
            <Card key={listing.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{listing.title}</h2>
                <Badge>{t(`marketplace.status.${listing.status}`)}</Badge>
              </div>
              {listing.description ? (
                <p className="text-sm text-slate-600">{listing.description}</p>
              ) : null}
              <div className="flex items-center justify-end text-sm text-slate-500">
                <span>{t("marketplace.pricePerDay", { value: listing.price })}</span>
              </div>
            </Card>
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
