"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isAuthenticated } from "@sanany/auth";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  RECENT_SEARCHES_STORAGE_KEY,
  SAVED_SEARCHES_STORAGE_KEY,
  parseStoredIdList,
  parseStoredSearches,
  upsertStoredSearch,
  type StoredSearch
} from "@sanany/shared";
import type { ListingsQuery, MarketplaceCategoryNode, MarketplaceListing, SellerProfile } from "@sanany/types";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { getWebCategoriesRepository } from "../lib/categories-repository";
import { getWebListingsRepository } from "../lib/listings-repository";
import { getWebSellersRepository } from "../lib/sellers-repository";
import { ListingCard } from "./listing-card";

type MarketplaceShellProps = {
  language: string;
};

type CityKey = "riyadh" | "jeddah" | "dammam" | "makkah" | "madinah";
type HomePreviewState = "default" | "loading" | "error" | "empty" | "guest";

type OwnerSummary = {
  active: number;
  drafts: number;
  reserved: number;
};

const CITY_KEYS: readonly CityKey[] = ["riyadh", "jeddah", "dammam", "makkah", "madinah"];
const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4";
const EXPERIENCE_ICONS: Record<MarketplaceCategoryNode["experienceKey"], string> = {
  general: "📦",
  vehicles: "🚗",
  real_estate: "🏠",
  electronics: "📱",
  livestock: "🐑",
  jobs: "💼",
  services: "🛠️"
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function listingMatchesCity(listing: MarketplaceListing, cityLabel: string): boolean {
  if (!listing.locationName || cityLabel.trim().length === 0) {
    return false;
  }

  return normalizeText(listing.locationName).includes(normalizeText(cityLabel));
}

function listingMatchesSearch(listing: MarketplaceListing, search: StoredSearch): boolean {
  const query = search.query.trim().toLowerCase();
  const haystack = [listing.title, listing.description ?? "", listing.locationName ?? "", listing.categorySlug ?? ""].join(" ").toLowerCase();
  if (query.length > 0 && !haystack.includes(query)) {
    return false;
  }

  if (search.city && !listingMatchesCity(listing, search.city)) {
    return false;
  }

  if (search.categorySlug && listing.categorySlug !== search.categorySlug) {
    return false;
  }

  return true;
}

function sortFeaturedListings(items: MarketplaceListing[], sellerMap: Map<string, SellerProfile>): MarketplaceListing[] {
  return [...items].sort((left, right) => {
    const leftSeller = left.ownerId ? sellerMap.get(left.ownerId) : null;
    const rightSeller = right.ownerId ? sellerMap.get(right.ownerId) : null;
    const leftTrust = Number(Boolean(leftSeller?.isVerified)) * 2 + ((leftSeller?.ratingCount ?? 0) > 0 ? 1 : 0);
    const rightTrust = Number(Boolean(rightSeller?.isVerified)) * 2 + ((rightSeller?.ratingCount ?? 0) > 0 ? 1 : 0);
    if (leftTrust !== rightTrust) {
      return rightTrust - leftTrust;
    }

    const leftHasImage = left.imageUrl ? 1 : 0;
    const rightHasImage = right.imageUrl ? 1 : 0;
    if (leftHasImage !== rightHasImage) {
      return rightHasImage - leftHasImage;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function uniqueListings(items: MarketplaceListing[]): MarketplaceListing[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function selectListingsByIds(ids: string[], items: MarketplaceListing[]): MarketplaceListing[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => itemMap.get(id)).filter((item): item is MarketplaceListing => Boolean(item));
}

function HomeSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-64 rounded-[32px] bg-slate-200" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`intent-skeleton-${index}`} className="h-28 rounded-3xl bg-slate-200" />
        ))}
      </div>
      <div className={GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`card-skeleton-${index}`} className="h-80 rounded-3xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

function SectionHeader(props: { title: string; description: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{props.title}</h2>
        <p className="text-sm leading-6 text-slate-500">{props.description}</p>
      </div>
      {props.actionLabel && props.actionHref ? (
        <Link href={props.actionHref} className="text-sm font-semibold text-brand hover:underline">
          {props.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function SellerTrustCard(props: { seller: SellerProfile; language: string; listingCount: number }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/${props.language}/seller/${props.seller.id}`}
      className="group rounded-3xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{t("home.verifiedBadge")}</div>
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand">{props.seller.displayName}</h3>
          <p className="text-xs text-slate-500">@{props.seller.username ?? t("home.seller.defaultUsername")}</p>
        </div>
        <span className="text-2xl" aria-hidden>
          ⭐
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-slate-50 px-2 py-3">
          <p className="text-lg font-bold text-slate-900">{props.seller.ratingAverage.toFixed(1)}</p>
          <p className="text-[11px] text-slate-500">{t("home.trustedSeller.rating")}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-2 py-3">
          <p className="text-lg font-bold text-slate-900">{props.seller.ratingCount}</p>
          <p className="text-[11px] text-slate-500">{t("home.trustedSeller.reviews")}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-2 py-3">
          <p className="text-lg font-bold text-slate-900">{props.listingCount}</p>
          <p className="text-[11px] text-slate-500">{t("home.trustedSeller.listings")}</p>
        </div>
      </div>
    </Link>
  );
}

export function MarketplaceShell({ language }: MarketplaceShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listingsRepository = useMemo(() => getWebListingsRepository(), []);
  const sellersRepository = useMemo(() => getWebSellersRepository(), []);
  const categoriesRepository = useMemo(() => getWebCategoriesRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const addListingHref = isAuthenticated(snapshot) ? `/${resolvedLanguage}/my-ads` : `/${resolvedLanguage}/auth`;

  const [searchText, setSearchText] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityKey>("riyadh");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [previewState, setPreviewState] = useState<HomePreviewState>("default");
  const [latestListings, setLatestListings] = useState<MarketplaceListing[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategoryNode[]>([]);
  const [trustedSellers, setTrustedSellers] = useState<SellerProfile[]>([]);
  const [sellerProfilesByOwnerId, setSellerProfilesByOwnerId] = useState<Map<string, SellerProfile>>(new Map());
  const [recentSearches, setRecentSearches] = useState<StoredSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<StoredSearch[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentViewIds, setRecentViewIds] = useState<string[]>([]);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);

  const selectedCityLabel = t(`siteLayout.cities.${selectedCity}`);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextPreviewState = params.get("previewState");
    if (nextPreviewState === "loading" || nextPreviewState === "error" || nextPreviewState === "empty" || nextPreviewState === "guest") {
      setPreviewState(nextPreviewState);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      setRecentSearches(parseStoredSearches(window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)));
      setSavedSearches(parseStoredSearches(window.localStorage.getItem(SAVED_SEARCHES_STORAGE_KEY)));
      setFavoriteIds(parseStoredIdList(window.localStorage.getItem(FAVORITES_STORAGE_KEY)));
      setRecentViewIds(parseStoredIdList(window.localStorage.getItem(LISTING_VIEWS_STORAGE_KEY)));
    } catch {
      setRecentSearches([]);
      setSavedSearches([]);
      setFavoriteIds([]);
      setRecentViewIds([]);
    }
  }, [retryToken]);

  useEffect(() => {
    let active = true;
    const query: ListingsQuery = { search: "", status: "all", sort: "newest", page: 1, pageSize: 120 };

    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [listingsResult, categoryTree] = await Promise.all([listingsRepository.list(query), categoriesRepository.listCategoryTree()]);
        if (!active) {
          return;
        }

        const items = listingsResult.items;
        setLatestListings(items);
        setCategories(categoryTree);

        const ownerIds = Array.from(
          new Set(items.map((item) => item.ownerId).filter((ownerId): ownerId is string => typeof ownerId === "string" && ownerId.length > 0))
        ).slice(0, 18);

        const sellerProfiles = await Promise.all(ownerIds.map((ownerId) => sellersRepository.getProfile(ownerId, snapshot.user?.id ?? null)));
        if (!active) {
          return;
        }

        const sellerMap = new Map(
          sellerProfiles.filter((profile): profile is SellerProfile => profile !== null).map((profile) => [profile.id, profile] as const)
        );
        setSellerProfilesByOwnerId(sellerMap);
        setTrustedSellers(
          [...sellerMap.values()]
            .filter((seller) => seller.isVerified)
            .sort((left, right) => right.ratingCount - left.ratingCount || right.ratingAverage - left.ratingAverage || right.listingsCount - left.listingsCount)
            .slice(0, 4)
        );
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : t("marketplace.loadError"));
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
  }, [categoriesRepository, listingsRepository, retryToken, sellersRepository, snapshot.user?.id, t]);

  useEffect(() => {
    if (!isAuthenticated(snapshot) || !snapshot.user?.id || previewState === "guest") {
      setOwnerSummary(null);
      return;
    }

    let active = true;
    const ownerId = snapshot.user.id;

    const run = async () => {
      try {
        const [activeListings, draftListings, reservedListings] = await Promise.all([
          listingsRepository.listByOwner(ownerId, { search: "", status: "available", sort: "newest", page: 1, pageSize: 1 }),
          listingsRepository.listByOwner(ownerId, { search: "", status: "draft", sort: "newest", page: 1, pageSize: 1 }),
          listingsRepository.listByOwner(ownerId, { search: "", status: "reserved", sort: "newest", page: 1, pageSize: 1 })
        ]);

        if (!active) {
          return;
        }

        setOwnerSummary({
          active: activeListings.totalItems,
          drafts: draftListings.totalItems,
          reserved: reservedListings.totalItems
        });
      } catch {
        if (active) {
          setOwnerSummary(null);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [listingsRepository, previewState, snapshot]);

  const visibleListings = useMemo(() => (previewState === "empty" ? [] : latestListings), [latestListings, previewState]);
  const sellerMap = sellerProfilesByOwnerId;
  const featuredListings = useMemo(() => sortFeaturedListings(visibleListings, sellerMap).slice(0, 8), [sellerMap, visibleListings]);
  const recentViewedListings = useMemo(() => selectListingsByIds(recentViewIds, visibleListings).slice(0, 8), [recentViewIds, visibleListings]);
  const favoriteListings = useMemo(() => selectListingsByIds(favoriteIds, visibleListings).slice(0, 8), [favoriteIds, visibleListings]);
  const nearbyListings = useMemo(() => visibleListings.filter((listing) => listingMatchesCity(listing, selectedCityLabel)).slice(0, 8), [selectedCityLabel, visibleListings]);
  const freshListings = useMemo(() => [...visibleListings].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 8), [visibleListings]);
  const personalizedRecommendations = useMemo(() => {
    const sourceSearches = [...savedSearches, ...recentSearches].slice(0, 6);
    const matched = uniqueListings(sourceSearches.flatMap((search) => visibleListings.filter((listing) => listingMatchesSearch(listing, search))));
    if (matched.length > 0) {
      return matched.slice(0, 8);
    }

    return uniqueListings([...favoriteListings, ...nearbyListings, ...featuredListings]).slice(0, 8);
  }, [favoriteListings, featuredListings, nearbyListings, recentSearches, savedSearches, visibleListings]);
  const continueBrowsing = useMemo(
    () => uniqueListings([...recentViewedListings, ...favoriteListings, ...freshListings]).slice(0, 8),
    [favoriteListings, freshListings, recentViewedListings]
  );

  const handleSearchNavigation = (input: { query: string; city?: string | null; categorySlug?: string | null }) => {
    const params = new URLSearchParams();
    if (input.query.trim().length > 0) {
      params.set("q", input.query.trim());
    }
    if (input.city?.trim()) {
      params.set("city", input.city.trim());
    }
    if (input.categorySlug?.trim()) {
      params.set("category", input.categorySlug.trim());
    }
    router.push(`/${resolvedLanguage}/search${params.toString().length > 0 ? `?${params.toString()}` : ""}`);
  };

  const persistSearch = (storageKey: typeof RECENT_SEARCHES_STORAGE_KEY | typeof SAVED_SEARCHES_STORAGE_KEY) => {
    if (typeof window === "undefined") {
      return;
    }

    const next = upsertStoredSearch(window.localStorage.getItem(storageKey), {
      query: searchText,
      city: selectedCityLabel
    });
    window.localStorage.setItem(storageKey, next.serialized);
    if (storageKey === RECENT_SEARCHES_STORAGE_KEY) {
      setRecentSearches(next.items);
    } else {
      setSavedSearches(next.items);
    }
  };

  const onSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    persistSearch(RECENT_SEARCHES_STORAGE_KEY);
    handleSearchNavigation({ query: searchText, city: selectedCityLabel });
  };

  const isGuestPreview = previewState === "guest";
  const showOwnerWorkspace = isAuthenticated(snapshot) && !isGuestPreview;
  const categoriesPreview = categories.slice(0, 8);

  if (previewState === "loading" || isLoading) {
    return <HomeSkeleton />;
  }

  return (
    <section dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="space-y-8">
      <Card className="overflow-hidden border-brand/15 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.14),_transparent_42%),linear-gradient(135deg,#ffffff_0%,#f8fcfd_45%,#eef8f8_100%)] p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand/80">{t("home.hero.eyebrow")}</p>
              <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-10 w-auto" priority />
              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t("home.hero.title")}</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{t("home.hero.subtitle")}</p>
              <p className="text-xs font-medium text-slate-500">{t("home.hero.helper")}</p>
            </div>

            <form onSubmit={onSubmitSearch} className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
              <div className="grid gap-3 lg:grid-cols-[1fr_190px_auto]">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">{t("siteLayout.header.searchLabel")}</span>
                  <input
                    ref={searchInputRef}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder={t("home.hero.searchPlaceholder")}
                    className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none ring-brand/20 transition focus:border-brand focus:ring"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">{t("siteLayout.header.cityLabel")}</span>
                  <select
                    value={selectedCity}
                    onChange={(event) => setSelectedCity(event.target.value as CityKey)}
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none ring-brand/20 transition focus:border-brand focus:ring"
                  >
                    {CITY_KEYS.map((cityKey) => (
                      <option key={cityKey} value={cityKey}>
                        {t(`siteLayout.cities.${cityKey}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2 self-end lg:grid-cols-1">
                  <button type="submit" className="h-12 rounded-2xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark">
                    {t("home.hero.searchAction")}
                  </button>
                  <button
                    type="button"
                    disabled={searchText.trim().length === 0}
                    onClick={() => persistSearch(SAVED_SEARCHES_STORAGE_KEY)}
                    className="h-12 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("home.hero.saveSearch")}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {recentSearches.slice(0, 3).map((search) => (
                  <button
                    key={`recent-${search.id}`}
                    type="button"
                    onClick={() => handleSearchNavigation({ query: search.query, city: search.city, categorySlug: search.categorySlug })}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                  >
                    {t("home.search.recentPrefix")} {search.query}
                  </button>
                ))}
                {savedSearches.slice(0, 2).map((search) => (
                  <button
                    key={`saved-${search.id}`}
                    type="button"
                    onClick={() => handleSearchNavigation({ query: search.query, city: search.city, categorySlug: search.categorySlug })}
                    className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    {t("home.search.savedPrefix")} {search.query}
                  </button>
                ))}
              </div>
            </form>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="rounded-[28px] border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:border-brand/30 hover:shadow-md"
            >
              <p className="text-sm font-bold text-slate-900">{t("home.intents.findSpecific.title")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("home.intents.findSpecific.description")}</p>
            </button>
            <Link href={`/${resolvedLanguage}/categories`} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand/30 hover:shadow-md">
              <p className="text-sm font-bold text-slate-900">{t("home.intents.discover.title")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("home.intents.discover.description")}</p>
            </Link>
            <Link
              href={`/${resolvedLanguage}/search${savedSearches[0] ? `?q=${encodeURIComponent(savedSearches[0].query)}` : ""}`}
              className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand/30 hover:shadow-md"
            >
              <p className="text-sm font-bold text-slate-900">{t("home.intents.compare.title")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("home.intents.compare.description")}</p>
            </Link>
            <Link href={`/${resolvedLanguage}/search?city=${encodeURIComponent(selectedCityLabel)}`} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand/30 hover:shadow-md">
              <p className="text-sm font-bold text-slate-900">{t("home.intents.monitor.title")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("home.intents.monitor.description")}</p>
            </Link>
            <Link
              href={recentViewedListings[0] ? `/${resolvedLanguage}/listing/${recentViewedListings[0].id}` : `/${resolvedLanguage}/favorites`}
              className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand/30 hover:shadow-md"
            >
              <p className="text-sm font-bold text-slate-900">{t("home.intents.continue.title")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("home.intents.continue.description")}</p>
            </Link>
            <Link href={addListingHref} className="rounded-[28px] border border-brand/20 bg-brand/[0.06] p-4 shadow-sm transition hover:border-brand/40 hover:bg-brand/[0.08]">
              <p className="text-sm font-bold text-slate-900">{t("home.intents.manage.title")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("home.intents.manage.description")}</p>
            </Link>
          </div>
        </div>
      </Card>

      {previewState === "error" || error ? (
        <Card className="space-y-3 border-red-200">
          <p className="text-sm font-semibold text-red-600">{t("marketplace.loadError")}</p>
          <p className="text-xs text-slate-600">{error ?? t("home.empty.description")}</p>
          <button
            type="button"
            onClick={() => setRetryToken((current) => current + 1)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {t("common.retry")}
          </button>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="space-y-4 rounded-[28px] border-slate-200 p-5">
          <SectionHeader title={t("home.sections.yourMarket")} description={t("home.sectionDescriptions.yourMarket")} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{t("home.activity.recentSearches")}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{recentSearches.length}</p>
              <p className="mt-1 text-xs text-slate-500">{t("home.activity.recentSearchesHint")}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{t("home.activity.savedSearches")}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{savedSearches.length}</p>
              <p className="mt-1 text-xs text-slate-500">{t("home.activity.savedSearchesHint")}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{t("home.activity.recentlyViewed")}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{recentViewedListings.length}</p>
              <p className="mt-1 text-xs text-slate-500">{t("home.activity.recentlyViewedHint")}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{t("home.activity.nearby")}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{nearbyListings.length}</p>
              <p className="mt-1 text-xs text-slate-500">{selectedCityLabel}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 rounded-[28px] border-slate-200 p-5">
          <SectionHeader title={t("home.sections.yourListings")} description={t("home.sectionDescriptions.yourListings")} />
          {showOwnerWorkspace && ownerSummary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-700">{t("home.owner.active")}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{ownerSummary.active}</p>
                </div>
                <div className="rounded-3xl bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-700">{t("home.owner.drafts")}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{ownerSummary.drafts}</p>
                </div>
                <div className="rounded-3xl bg-sky-50 p-4">
                  <p className="text-xs font-semibold text-sky-700">{t("home.owner.reserved")}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{ownerSummary.reserved}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/${resolvedLanguage}/my-ads`} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
                  {t("home.owner.manageAction")}
                </Link>
                <Link href={addListingHref} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand">
                  {t("home.hero.addListing")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">{t("home.owner.guestTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("home.owner.guestDescription")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={addListingHref} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
                  {t("home.hero.addListing")}
                </Link>
                <Link href={`/${resolvedLanguage}/auth`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand">
                  {t("siteLayout.auth.signIn")}
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader title={t("home.sections.categories")} description={t("home.sectionDescriptions.categories")} actionLabel={t("home.seeAll")} actionHref={`/${resolvedLanguage}/categories`} />
        {categoriesPreview.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {categoriesPreview.map((category) => (
              <Link
                key={category.id}
                href={`/${resolvedLanguage}/search?category=${encodeURIComponent((category.children[0] ?? category).slug)}`}
                className="rounded-[28px] border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900">{resolvedLanguage === "ar" ? category.nameAr : category.nameEn}</h3>
                    <p className="text-sm text-slate-500">{category.children.length > 0 ? category.children.length : 1} {t("home.categories.childCount")}</p>
                  </div>
                  <span className="text-3xl" aria-hidden>
                    {EXPERIENCE_ICONS[category.experienceKey]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="rounded-[28px] p-5">
            <p className="text-sm text-slate-600">{t("categories.emptyDescription")}</p>
          </Card>
        )}
      </div>

      {savedSearches.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.savedSearches")} description={t("home.sectionDescriptions.savedSearches")} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {savedSearches.slice(0, 4).map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => handleSearchNavigation({ query: search.query, city: search.city, categorySlug: search.categorySlug })}
                className="rounded-[28px] border border-slate-200 bg-white p-4 text-start transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-slate-900">{search.query}</p>
                <p className="mt-2 text-sm text-slate-500">{search.city ?? t("home.search.anywhere")}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {personalizedRecommendations.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.personalized")} description={t("home.sectionDescriptions.personalized")} actionLabel={t("home.seeAll")} actionHref={`/${resolvedLanguage}/search`} />
          <div className={GRID_CLASS}>
            {personalizedRecommendations.map((listing) => (
              <ListingCard
                key={`personalized-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerMap.get(listing.ownerId) ?? null : null}
                insightLabel={t("home.card.recommended")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {recentViewedListings.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.recentlyViewed")} description={t("home.sectionDescriptions.recentlyViewed")} />
          <div className={GRID_CLASS}>
            {recentViewedListings.map((listing) => (
              <ListingCard
                key={`recent-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerMap.get(listing.ownerId) ?? null : null}
                insightLabel={t("home.card.continue")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {nearbyListings.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader
            title={t("home.sections.nearby")}
            description={t("home.sectionDescriptions.nearby", { city: selectedCityLabel })}
            actionLabel={t("home.seeAll")}
            actionHref={`/${resolvedLanguage}/search?city=${encodeURIComponent(selectedCityLabel)}`}
          />
          <div className={GRID_CLASS}>
            {nearbyListings.map((listing) => (
              <ListingCard
                key={`nearby-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerMap.get(listing.ownerId) ?? null : null}
                insightLabel={selectedCityLabel}
              />
            ))}
          </div>
        </div>
      ) : null}

      {trustedSellers.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.trustedSellers")} description={t("home.sectionDescriptions.trustedSellers")} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {trustedSellers.map((seller) => (
              <SellerTrustCard key={seller.id} seller={seller} language={resolvedLanguage} listingCount={seller.listingsCount} />
            ))}
          </div>
        </div>
      ) : null}

      {freshListings.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.newToday")} description={t("home.sectionDescriptions.newToday")} actionLabel={t("home.seeAll")} actionHref={`/${resolvedLanguage}/search?sort=newest`} />
          <div className={GRID_CLASS}>
            {freshListings.map((listing) => (
              <ListingCard
                key={`fresh-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerMap.get(listing.ownerId) ?? null : null}
                insightLabel={t("home.card.new")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {featuredListings.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.featured")} description={t("home.sectionDescriptions.featured")} />
          <div className={GRID_CLASS}>
            {featuredListings.map((listing) => (
              <ListingCard
                key={`featured-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerMap.get(listing.ownerId) ?? null : null}
                insightLabel={t("home.card.featured")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {continueBrowsing.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.continueBrowsing")} description={t("home.sectionDescriptions.continueBrowsing")} />
          <div className={GRID_CLASS}>
            {continueBrowsing.map((listing) => (
              <ListingCard
                key={`continue-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerMap.get(listing.ownerId) ?? null : null}
                insightLabel={t("home.card.continue")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!error && visibleListings.length === 0 ? (
        <Card className="space-y-2 rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t("home.empty.title")}</h2>
          <p className="text-sm text-slate-600">{t("home.empty.description")}</p>
        </Card>
      ) : null}
    </section>
  );
}
