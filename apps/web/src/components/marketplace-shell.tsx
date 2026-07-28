"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isAuthenticated } from "@sanany/auth";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  RECENT_SEARCHES_STORAGE_KEY,
  SAVED_SEARCHES_STORAGE_KEY,
  collectLeafCategories,
  parseStoredIdList,
  parseStoredSearches,
  resolveCategorySearchTarget,
  upsertStoredSearch,
  type StoredSearch
} from "@sanany/shared";
import type { FollowedSellerStories, ListingsQuery, MarketplaceCategoryNode, MarketplaceListing, SellerProfile } from "@sanany/types";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { getWebCategoriesRepository } from "../lib/categories-repository";
import { getWebListingsRepository } from "../lib/listings-repository";
import { getWebSellersRepository } from "../lib/sellers-repository";
import { getWebStoriesRepository } from "../lib/stories-repository";
import { ListingCard } from "./listing-card";
import { StoriesCarousel } from "./stories-carousel";

type MarketplaceShellProps = {
  language: string;
};

type CityKey = "riyadh" | "jeddah" | "dammam" | "makkah" | "madinah";
type HomePreviewState = "default" | "loading" | "error" | "empty" | "guest";
type OwnerSummary = { active: number; drafts: number; reserved: number };

const CITY_KEYS: readonly CityKey[] = ["riyadh", "jeddah", "dammam", "makkah", "madinah"];
const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4";
const CATEGORY_GRID_CLASS = "grid grid-cols-2 gap-3 md:grid-cols-4";
const EXPERIENCE_ICONS: Record<MarketplaceCategoryNode["experienceKey"], string> = {
  general: "📦",
  vehicles: "🚗",
  real_estate: "🏠",
  electronics: "📱",
  livestock: "🐑",
  jobs: "💼",
  services: "🛠️"
};
const ROTATING_PLACEHOLDERS = ["آيفون 15 مستعمل بحالة ممتازة", "شقة في حي العليا بالرياض", "سيارة هوندا سيفيك 2022", "كنب غرفة جلوس", "لاب توب للدراسة"];

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

function uniqueListings(items: MarketplaceListing[]): MarketplaceListing[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function selectListingsByIds(ids: string[], items: MarketplaceListing[]): MarketplaceListing[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => itemMap.get(id)).filter((item): item is MarketplaceListing => Boolean(item));
}

function pickPrimarySearch(savedSearches: StoredSearch[], recentSearches: StoredSearch[]): StoredSearch | null {
  return savedSearches[0] ?? recentSearches[0] ?? null;
}

function HomeSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-64 rounded-[34px] bg-slate-200" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-32 rounded-[28px] bg-slate-200" />
        <div className="h-32 rounded-[28px] bg-slate-200" />
      </div>
      <div className={GRID_CLASS}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`home-skeleton-${index}`} className="h-72 rounded-[28px] bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

function SectionHeader(props: { title: string; description: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-black tracking-tight text-slate-950">{props.title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">{props.description}</p>
      </div>
      {props.actionLabel && props.actionHref ? (
        <Link href={props.actionHref} className="text-sm font-semibold text-brand hover:underline">
          {props.actionLabel}
        </Link>
      ) : null}
    </div>
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
  const storiesRepository = useMemo(() => getWebStoriesRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const addListingHref = isAuthenticated(snapshot) ? `/${resolvedLanguage}/my-ads` : `/${resolvedLanguage}/auth`;

  const [searchText, setSearchText] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityKey>("riyadh");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<HomePreviewState>("default");
  const [retryToken, setRetryToken] = useState(0);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategoryNode[]>([]);
  const [sellerProfilesByOwnerId, setSellerProfilesByOwnerId] = useState<Map<string, SellerProfile>>(new Map());
  const [recentSearches, setRecentSearches] = useState<StoredSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<StoredSearch[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentViewIds, setRecentViewIds] = useState<string[]>([]);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);
  const [followedStories, setFollowedStories] = useState<FollowedSellerStories[]>([]);

  const selectedCityLabel = t(`siteLayout.cities.${selectedCity}`);
  const rotatingPlaceholder = searchText.trim().length === 0 ? ROTATING_PLACEHOLDERS[placeholderIdx] : "";

  useEffect(() => {
    if (searchText.trim().length > 0) return;
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % ROTATING_PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, [searchText]);

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

    if (previewState === "error") {
      setIsLoading(false);
      setError(t("marketplace.loadError"));
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [listingsResult, categoryTree] = await Promise.all([listingsRepository.list(query), categoriesRepository.listCategoryTree()]);
        if (!active) {
          return;
        }

        const nextListings = previewState === "empty" ? [] : listingsResult.items;
        setListings(nextListings);
        setCategories(categoryTree.slice(0, 6));

        const ownerIds = Array.from(
          new Set(nextListings.map((item) => item.ownerId).filter((ownerId): ownerId is string => typeof ownerId === "string" && ownerId.length > 0))
        ).slice(0, 16);
        const profiles = await Promise.all(ownerIds.map((ownerId) => sellersRepository.getProfile(ownerId, snapshot.user?.id ?? null)));
        if (!active) {
          return;
        }

        setSellerProfilesByOwnerId(
          new Map(profiles.filter((profile): profile is SellerProfile => profile !== null).map((profile) => [profile.id, profile] as const))
        );
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("marketplace.loadError"));
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
  }, [categoriesRepository, listingsRepository, previewState, sellersRepository, snapshot.user?.id, t]);

  useEffect(() => {
    if (previewState === "guest" || !snapshot.user?.id) {
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
  }, [listingsRepository, previewState, snapshot.user?.id]);

  // ── Stories ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!snapshot.user?.id || previewState === "guest") {
      setFollowedStories([]);
      return;
    }
    let active = true;
    const userId = snapshot.user.id;
    storiesRepository.getFollowedSellersStories(userId).then((data) => {
      if (active) setFollowedStories(data);
    }).catch(() => {});
    return () => { active = false; };
  }, [snapshot.user?.id, previewState, storiesRepository]);

  const handleMarkViewed = useCallback((storyId: string) => {
    if (!snapshot.user?.id) return;
    void storiesRepository.markStoryViewed(storyId, snapshot.user.id);
  }, [snapshot.user?.id, storiesRepository]);
  const sellerActivityCount = (ownerSummary?.active ?? 0) + (ownerSummary?.drafts ?? 0) + (ownerSummary?.reserved ?? 0);
  const buyerSignalCount = recentSearches.length + savedSearches.length + recentViewIds.length + favoriteIds.length;
  const isSellerFocused = sellerActivityCount > Math.max(2, buyerSignalCount) && previewState !== "guest";

  const recentViewedListings = useMemo(() => selectListingsByIds(recentViewIds, listings).slice(0, 4), [listings, recentViewIds]);
  const favoriteListings = useMemo(() => selectListingsByIds(favoriteIds, listings).slice(0, 4), [favoriteIds, listings]);
  const nearbyListings = useMemo(() => listings.filter((listing) => listingMatchesCity(listing, selectedCityLabel)).slice(0, 4), [listings, selectedCityLabel]);
  const savedSearchSeed = useMemo(() => pickPrimarySearch(savedSearches, recentSearches), [recentSearches, savedSearches]);
  const personalizedListings = useMemo(() => {
    const sourceSearches = [...savedSearches, ...recentSearches].slice(0, 6);
    const matched = uniqueListings(sourceSearches.flatMap((search) => listings.filter((listing) => listingMatchesSearch(listing, search))));
    if (matched.length > 0) {
      return matched.slice(0, 4);
    }

    return uniqueListings([...recentViewedListings, ...favoriteListings, ...nearbyListings, ...listings]).slice(0, 4);
  }, [favoriteListings, listings, nearbyListings, recentSearches, recentViewedListings, savedSearches]);

  const primaryAssistantCopy = recentViewedListings.length > 0
    ? t("home.hero.assistantContinue")
    : savedSearches.length > 0
      ? t("home.hero.assistantSaved")
      : isSellerFocused
        ? t("home.hero.assistantSeller")
        : nearbyListings.length > 0
          ? t("home.hero.assistantNearby")
          : t("home.hero.assistantDefault");

  const persistSearch = (storageKey: typeof RECENT_SEARCHES_STORAGE_KEY | typeof SAVED_SEARCHES_STORAGE_KEY) => {
    if (typeof window === "undefined") {
      return;
    }

    const next = upsertStoredSearch(window.localStorage.getItem(storageKey), { query: searchText, city: selectedCityLabel });
    window.localStorage.setItem(storageKey, next.serialized);
    if (storageKey === RECENT_SEARCHES_STORAGE_KEY) {
      setRecentSearches(next.items);
    } else {
      setSavedSearches(next.items);
    }
  };

  const openSearch = (input: { query?: string | null; city?: string | null; categorySlug?: string | null }) => {
    const params = new URLSearchParams();
    if (input.query?.trim()) {
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

  const onSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    persistSearch(RECENT_SEARCHES_STORAGE_KEY);
    openSearch({ query: searchText, city: selectedCityLabel });
  };

  if (previewState === "loading" || isLoading) {
    return <HomeSkeleton />;
  }

  return (
    <section dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="space-y-8">
      {(followedStories.length > 0 || snapshot.user?.id) ? (
        <div className="space-y-2">
          <p className="px-1 text-xs font-bold uppercase tracking-widest text-slate-400">{t("home.stories.sectionLabel")}</p>
          <Card className="overflow-hidden border-slate-100 p-4">
            <StoriesCarousel
              followedStories={followedStories}
              currentUserId={snapshot.user?.id ?? null}
              currentUserName={snapshot.user ? (snapshot.user as { displayName?: string }).displayName ?? "أنا" : undefined}
              onAddStory={() => router.push(`/${resolvedLanguage}/my-ads`)}
              onMarkViewed={handleMarkViewed}
              onOpenListing={(listingId) => router.push(`/${resolvedLanguage}/listing/${listingId}`)}
            />
          </Card>
        </div>
      ) : null}

      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf9_55%,#f8fbfd_100%)] p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <form onSubmit={onSubmitSearch} className="space-y-3 rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm">
              {/* Search input — full width always */}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-500">{t("siteLayout.header.searchLabel")}</span>
                <input
                  ref={searchInputRef}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={rotatingPlaceholder || t("home.hero.searchPlaceholder")}
                  className="h-11 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none ring-brand/20 transition focus:border-brand focus:ring"
                />
              </label>

              {/* City + map icon + submit — responsive row */}
              <div className="flex items-end gap-2">
                <label className="block min-w-0 flex-1 space-y-1">
                  <span className="text-xs font-semibold text-slate-500">{t("siteLayout.header.cityLabel")}</span>
                  <select
                    value={selectedCity}
                    onChange={(event) => setSelectedCity(event.target.value as CityKey)}
                    className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/20 transition focus:border-brand focus:ring"
                  >
                    {CITY_KEYS.map((cityKey) => (
                      <option key={cityKey} value={cityKey}>
                        {t(`siteLayout.cities.${cityKey}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <Link
                  href={`/${resolvedLanguage}/map`}
                  title={t("home.nextAction.mapCta")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 text-base transition hover:bg-teal-100"
                >
                  🗺️
                </Link>
                <button type="submit" className="h-11 shrink-0 rounded-2xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-dark">
                  {t("home.hero.searchAction")}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.slice(0, 2).map((search) => (
                  <button
                    key={`recent-${search.id}`}
                    type="button"
                    onClick={() => openSearch({ query: search.query, city: search.city, categorySlug: search.categorySlug })}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                  >
                    {t("home.search.recentPrefix")} {search.query}
                  </button>
                ))}
                {savedSearches.slice(0, 2).map((search) => (
                  <button
                    key={`saved-${search.id}`}
                    type="button"
                    onClick={() => openSearch({ query: search.query, city: search.city, categorySlug: search.categorySlug })}
                    className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    {t("home.search.savedPrefix")} {search.query}
                  </button>
                ))}
              </div>
            </form>

            {categories.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => openSearch({ categorySlug: resolveCategorySearchTarget(cat).slug })}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 hover:text-brand"
                  >
                    <span>{EXPERIENCE_ICONS[cat.experienceKey]}</span>
                    <span>{resolvedLanguage === "ar" ? cat.nameAr : cat.nameEn}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

        </div>
      </Card>

      {previewState === "error" || error ? (
        <Card className="space-y-3 border-red-200 p-5">
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

      {savedSearches.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.savedSearches")} description={t("home.sectionDescriptions.savedSearches")} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {savedSearches.slice(0, 4).map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => openSearch({ query: search.query, city: search.city, categorySlug: search.categorySlug })}
                className="rounded-[28px] border border-slate-200 bg-white p-4 text-start transition hover:border-brand/20 hover:shadow-sm"
              >
                <p className="text-sm font-bold text-slate-900">{search.query}</p>
                <p className="mt-2 text-sm text-slate-500">{search.city ?? t("home.search.anywhere")}</p>
              </button>
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
                sellerProfile={listing.ownerId ? sellerProfilesByOwnerId.get(listing.ownerId) ?? null : null}
                insightLabel={t("home.card.continue")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {personalizedListings.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.personalized")} description={t("home.sectionDescriptions.personalized")} actionLabel={t("home.seeAll")} actionHref={`/${resolvedLanguage}/search`} />
          <div className={GRID_CLASS}>
            {personalizedListings.map((listing) => (
              <ListingCard
                key={`personalized-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerProfilesByOwnerId.get(listing.ownerId) ?? null : null}
                insightLabel={t("home.card.recommended")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!isSellerFocused && nearbyListings.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.nearby")} description={t("home.sectionDescriptions.nearby", { city: selectedCityLabel })} actionLabel={t("home.seeAll")} actionHref={`/${resolvedLanguage}/search?city=${encodeURIComponent(selectedCityLabel)}`} />
          <div className={GRID_CLASS}>
            {nearbyListings.map((listing) => (
              <ListingCard
                key={`nearby-${listing.id}`}
                listing={listing}
                language={resolvedLanguage}
                sellerProfile={listing.ownerId ? sellerProfilesByOwnerId.get(listing.ownerId) ?? null : null}
                insightLabel={selectedCityLabel}
              />
            ))}
          </div>
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader title={t("home.sections.categories")} description={t("home.sectionDescriptions.categories")} actionLabel={t("home.seeAll")} actionHref={`/${resolvedLanguage}/categories`} />
          <div className={CATEGORY_GRID_CLASS}>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/${resolvedLanguage}/search?category=${encodeURIComponent(resolveCategorySearchTarget(category).slug)}`}
                className="rounded-[28px] border border-slate-200 bg-white p-4 transition hover:border-brand/20 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">{resolvedLanguage === "ar" ? category.nameAr : category.nameEn}</h3>
                    <p className="text-xs text-slate-500">{collectLeafCategories(category).length || 1} {t("home.categories.childCount")}</p>
                  </div>
                  <span className="text-2xl" aria-hidden>
                    {EXPERIENCE_ICONS[category.experienceKey]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!error && listings.length === 0 ? (
        <Card className="space-y-2 rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t("home.empty.title")}</h2>
          <p className="text-sm text-slate-600">{t("home.empty.description")}</p>
        </Card>
      ) : null}
    </section>
  );
}
