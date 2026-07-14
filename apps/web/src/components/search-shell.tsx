"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ListingCategory, ListingsFilters, ListingsQuery, MarketplaceCategory, MarketplaceListing, PaginatedResult, SearchCityKey } from "@sanany/types";
import { Card } from "@sanany/ui";
import {
  countActiveListingsFilters,
  isCarCategory,
  matchesListingsFilters,
  parseListingsQueryFromParams,
  toListingsQueryParams
} from "@sanany/shared";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebCategoriesRepository } from "../lib/categories-repository";
import { getWebListingsRepository } from "../lib/listings-repository";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ListingCard } from "./listing-card";
import { ListingsMap } from "./listings-map";

type SearchShellProps = {
  language: string;
};

const PAGE_SIZE = 12;
const FETCH_PAGE_SIZE = 300;
const CITY_KEYS: readonly SearchCityKey[] = ["riyadh", "jeddah", "dammam", "makkah", "madinah"];

type ViewMode = "grid" | "list";

function parseViewMode(value: string | null): ViewMode {
  return value === "list" ? "list" : "grid";
}

function FiltersPanel({
  query,
  categories,
  language,
  onFiltersChange,
  onClearFilters
}: {
  query: ListingsQuery;
  categories: MarketplaceCategory[];
  language: "ar" | "en";
  onFiltersChange(next: ListingsFilters): void;
  onClearFilters(): void;
}) {
  const { t } = useTranslation();
  const filters = query.filters ?? {};
  const carSpecific = isCarCategory(filters.category);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700">{t("search.filters.category")}</label>
        <select
          value={filters.category ?? ""}
          onChange={(event) => onFiltersChange({ ...filters, category: (event.target.value || undefined) as ListingCategory | undefined })}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
        >
          <option value="">{t("search.filters.anyCategory")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {t(`marketplace.create.categories.${category.slug}`, { defaultValue: language === "ar" ? category.nameAr : category.nameEn })}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700">{t("search.filters.city")}</label>
        <select
          value={filters.city ?? ""}
          onChange={(event) => onFiltersChange({ ...filters, city: (event.target.value || undefined) as SearchCityKey | undefined })}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
        >
          <option value="">{t("search.filters.anyCity")}</option>
          {CITY_KEYS.map((city) => (
            <option key={city} value={city}>
              {t(`siteLayout.cities.${city}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">{t("search.filters.minPrice")}</span>
          <input
            type="number"
            min={0}
            value={filters.minPrice ?? ""}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                minPrice: event.target.value.trim().length > 0 ? Number(event.target.value) : undefined
              })
            }
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">{t("search.filters.maxPrice")}</span>
          <input
            type="number"
            min={0}
            value={filters.maxPrice ?? ""}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                maxPrice: event.target.value.trim().length > 0 ? Number(event.target.value) : undefined
              })
            }
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
          />
        </label>
      </div>

      {carSpecific ? (
        <>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t("search.filters.brand")}</label>
            <input
              value={filters.brand ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, brand: event.target.value || undefined })}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t("search.filters.model")}</label>
            <input
              value={filters.model ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, model: event.target.value || undefined })}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t("search.filters.year")}</label>
            <input
              value={filters.year ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, year: event.target.value || undefined })}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t("search.filters.condition")}</label>
            <select
              value={filters.carCondition ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, carCondition: (event.target.value || undefined) as ListingsFilters["carCondition"] })}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            >
              <option value="">{t("search.filters.anyCondition")}</option>
              <option value="new">{t("marketplace.create.carDetails.conditionOptions.new")}</option>
              <option value="likeNew">{t("marketplace.create.carDetails.conditionOptions.likeNew")}</option>
              <option value="used">{t("marketplace.create.carDetails.conditionOptions.used")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t("search.filters.fuel")}</label>
            <select
              value={filters.carFuelType ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, carFuelType: (event.target.value || undefined) as ListingsFilters["carFuelType"] })}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            >
              <option value="">{t("search.filters.anyFuel")}</option>
              <option value="gasoline">{t("marketplace.create.carDetails.fuelOptions.gasoline")}</option>
              <option value="diesel">{t("marketplace.create.carDetails.fuelOptions.diesel")}</option>
              <option value="hybrid">{t("marketplace.create.carDetails.fuelOptions.hybrid")}</option>
              <option value="electric">{t("marketplace.create.carDetails.fuelOptions.electric")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t("search.filters.adType")}</label>
            <select
              value={filters.carAdType ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, carAdType: (event.target.value || undefined) as ListingsFilters["carAdType"] })}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            >
              <option value="">{t("search.filters.anyAdType")}</option>
              <option value="sell">{t("marketplace.create.carDetails.adTypeOptions.sell")}</option>
              <option value="transfer">{t("marketplace.create.carDetails.adTypeOptions.transfer")}</option>
              <option value="lease">{t("marketplace.create.carDetails.adTypeOptions.lease")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t("search.filters.priceMode")}</label>
            <select
              value={filters.carPriceMode ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, carPriceMode: (event.target.value || undefined) as ListingsFilters["carPriceMode"] })}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            >
              <option value="">{t("search.filters.anyPriceMode")}</option>
              <option value="fixed">{t("marketplace.create.carDetails.priceModeOptions.fixed")}</option>
              <option value="bid">{t("marketplace.create.carDetails.priceModeOptions.bid")}</option>
              <option value="byWork">{t("marketplace.create.carDetails.priceModeOptions.byWork")}</option>
            </select>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={onClearFilters}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {t("search.filters.clearAll")}
      </button>
    </div>
  );
}

export function SearchShell({ language }: SearchShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const repository = useMemo(() => getWebListingsRepository(), []);
  const categoriesRepository = useMemo(() => getWebCategoriesRepository(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const mode = searchParams.get("mode");
  const isLocationMode = mode === "location";

  const parsedQuery = useMemo(() => parseListingsQueryFromParams(new URLSearchParams(searchParams.toString()), PAGE_SIZE), [searchParams]);
  const viewMode = parseViewMode(searchParams.get("view"));
  const [searchDraft, setSearchDraft] = useState(parsedQuery.search);
  const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverData, setServerData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: FETCH_PAGE_SIZE,
    totalPages: 1
  });
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<MarketplaceCategory[]>([]);
  const resultCache = useRef<Map<string, PaginatedResult<MarketplaceListing>>>(new Map());

  useEffect(() => {
    setSearchDraft(parsedQuery.search);
  }, [parsedQuery.search]);

  useEffect(() => {
    let active = true;

    void categoriesRepository
      .listCategories()
      .then((result) => {
        if (!active) {
          return;
        }

        setCategoryOptions(result.filter((category) => category.parentId !== null));
      })
      .catch(() => {
        if (active) {
          setCategoryOptions([]);
        }
      });

    return () => {
      active = false;
    };
  }, [categoriesRepository]);

  useEffect(() => {
    const query: ListingsQuery = {
      ...parsedQuery,
      page: 1,
      pageSize: isLocationMode ? 500 : FETCH_PAGE_SIZE
    };
    const cacheKey = JSON.stringify(query);
    const cachedResult = resultCache.current.get(cacheKey);
    if (cachedResult) {
      setServerData(cachedResult);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void repository
      .list(query)
      .then((result) => {
        if (active) {
          resultCache.current.set(cacheKey, result);
          setServerData(result);
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
  }, [isLocationMode, parsedQuery, repository, t]);

  const filteredItems = useMemo(
    () => serverData.items.filter((item) => matchesListingsFilters(item, parsedQuery.filters)),
    [parsedQuery.filters, serverData.items]
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const page = Math.min(parsedQuery.page, totalPages);
  const pagedItems = useMemo(
    () => filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredItems, page]
  );
  const activeFiltersCount = countActiveListingsFilters(parsedQuery.filters);

  const updateSearchParams = (nextQuery: ListingsQuery, nextViewMode = viewMode, nextMode = mode) => {
    const params = toListingsQueryParams(nextQuery);
    if (nextViewMode !== "grid") {
      params.set("view", nextViewMode);
    }
    if (nextMode === "location") {
      params.set("mode", "location");
    }
    const queryText = params.toString();
    router.push(queryText.length > 0 ? `${pathname}?${queryText}` : pathname);
  };

  const onFiltersChange = (nextFilters: ListingsFilters) => {
    updateSearchParams({ ...parsedQuery, filters: nextFilters, page: 1 });
  };

  const onClearFilters = () => {
    updateSearchParams({ ...parsedQuery, filters: undefined, page: 1 });
    setIsFiltersDrawerOpen(false);
  };

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateSearchParams({ ...parsedQuery, search: searchDraft, page: 1 });
  };

  const onShareLink = async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }
    const value = window.location.href;
    try {
      await navigator.clipboard.writeText(value);
      setShareFeedback(t("search.shareCopied"));
    } catch {
      setShareFeedback(t("search.shareFailed"));
    }
  };

  if (isLocationMode) {
    return (
      <RequireAuth language={resolvedLanguage}>
        <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="relative h-screen w-full overflow-hidden bg-slate-100">
          <ListingsMap listings={filteredItems} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between p-4">
            <Link
              href={`/${resolvedLanguage}/search?${toListingsQueryParams(parsedQuery).toString()}`}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:border-brand/40 hover:text-brand"
              aria-label={t("search.backFromMap")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          </div>
        </main>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("search.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("search.pageSubtitle")}</p>
            {snapshot.user?.email ? <p className="text-xs text-slate-500">{t("marketplace.signOutHint", { email: snapshot.user.email })}</p> : null}
          </div>
          <LanguageSwitcher />
        </header>

        <AppNavigation language={resolvedLanguage} />

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <form onSubmit={onSearchSubmit} className="grid gap-2 md:grid-cols-[1fr_220px_auto_auto]">
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t("marketplace.searchPlaceholder")}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            />
            <select
              value={parsedQuery.sort}
              onChange={(event) => updateSearchParams({ ...parsedQuery, sort: event.target.value as ListingsQuery["sort"], page: 1 })}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:ring"
            >
              <option value="newest">{t("marketplace.sort.newest")}</option>
              <option value="priceHigh">{t("marketplace.sort.priceHigh")}</option>
              <option value="priceLow">{t("marketplace.sort.priceLow")}</option>
            </select>
            <button type="submit" className="h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark">
              {t("nav.search")}
            </button>
            <button
              type="button"
              onClick={onShareLink}
              className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t("search.share")}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "available", "reserved"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => updateSearchParams({ ...parsedQuery, status, page: 1 })}
                className={`rounded-full px-3 py-1 text-sm font-medium ${parsedQuery.status === status ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-700"}`}
              >
                {t(`marketplace.filters.${status}`)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => updateSearchParams(parsedQuery, viewMode === "grid" ? "list" : "grid")}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700"
            >
              {viewMode === "grid" ? t("search.view.list") : t("search.view.grid")}
            </button>
            <button
              type="button"
              onClick={() => setIsFiltersDrawerOpen(true)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 lg:hidden"
            >
              {t("search.filters.open", { count: activeFiltersCount })}
            </button>
            <Link
              href={`/${resolvedLanguage}/search?${(() => {
                const params = toListingsQueryParams(parsedQuery);
                params.set("mode", "location");
                return params.toString();
              })()}`}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700"
            >
              {t("marketplace.searchByLocation")}
            </Link>
            <span className="text-sm font-medium text-slate-700">{t("marketplace.listCount", { count: filteredItems.length })}</span>
          </div>
          {shareFeedback ? <p className="text-xs text-emerald-700">{shareFeedback}</p> : null}
        </section>

        {error ? (
          <Card className="space-y-2 border-red-200">
            <p className="text-sm font-semibold text-red-600">{t("marketplace.loadError")}</p>
            <p className="text-xs text-slate-500">{error}</p>
          </Card>
        ) : null}
        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <Card className="sticky top-24 space-y-3 p-4">
              <h2 className="text-sm font-bold text-slate-900">{t("search.filters.title")}</h2>
              <p className="text-xs text-slate-500">{t("search.filters.activeCount", { count: activeFiltersCount })}</p>
              <FiltersPanel
                query={parsedQuery}
                categories={categoryOptions}
                language={resolvedLanguage}
                onFiltersChange={onFiltersChange}
                onClearFilters={onClearFilters}
              />
            </Card>
          </aside>

          <section className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 grid-cols-1"}>
            {!isLoading && filteredItems.length === 0 ? (
              <Card className="col-span-full">
                <p className="text-sm text-slate-600">{t("marketplace.emptyState")}</p>
              </Card>
            ) : null}
            {pagedItems.map((listing) => (
              <ListingCard key={listing.id} listing={listing} language={resolvedLanguage} />
            ))}
          </section>
        </div>

        <section className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => updateSearchParams({ ...parsedQuery, page: Math.max(1, page - 1) })}
            disabled={page <= 1 || isLoading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {t("common.previous")}
          </button>
          <span className="text-sm text-slate-600">{t("common.page", { current: page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => updateSearchParams({ ...parsedQuery, page: Math.min(totalPages, page + 1) })}
            disabled={page >= totalPages || isLoading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {t("common.next")}
          </button>
        </section>

        {isFiltersDrawerOpen ? (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 lg:hidden" onClick={() => setIsFiltersDrawerOpen(false)}>
            <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">{t("search.filters.title")}</h2>
                <button type="button" onClick={() => setIsFiltersDrawerOpen(false)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                  {t("common.cancel")}
                </button>
              </div>
              <FiltersPanel
                query={parsedQuery}
                categories={categoryOptions}
                language={resolvedLanguage}
                onFiltersChange={onFiltersChange}
                onClearFilters={onClearFilters}
              />
            </div>
          </div>
        ) : null}
      </main>
    </RequireAuth>
  );
}
