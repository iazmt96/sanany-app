"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isAuthenticated } from "@sanany/auth";
import type { ListingsQuery, MarketplaceListing, SellerProfile } from "@sanany/types";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { getWebListingsRepository } from "../lib/listings-repository";
import { getWebSellersRepository } from "../lib/sellers-repository";
import { ListingCard } from "./listing-card";

type MarketplaceShellProps = {
  language: string;
};

type CityKey = "riyadh" | "jeddah" | "dammam" | "makkah" | "madinah";
type MainCategoryKey = "cars" | "realestate" | "electronics" | "services" | "furniture" | "jobs";

const CITY_KEYS: readonly CityKey[] = ["riyadh", "jeddah", "dammam", "makkah", "madinah"];
const MAIN_CATEGORY_KEYS: readonly MainCategoryKey[] = ["cars", "realestate", "electronics", "services", "furniture", "jobs"];
const GRID_CLASS = "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function listingMatchesCity(listing: MarketplaceListing, cityLabel: string): boolean {
  if (!listing.locationName || cityLabel.trim().length === 0) {
    return false;
  }
  const listingLocation = normalizeText(listing.locationName);
  return listingLocation.includes(normalizeText(cityLabel));
}

function listingMatchesKeywords(listing: MarketplaceListing, keywords: string[]): boolean {
  const haystack = `${listing.title} ${listing.description ?? ""} ${listing.locationName ?? ""}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function sortFeaturedListings(items: MarketplaceListing[]): MarketplaceListing[] {
  return [...items].sort((a, b) => {
    const aHasImage = a.imageUrl ? 1 : 0;
    const bHasImage = b.imageUrl ? 1 : 0;
    if (aHasImage !== bHasImage) {
      return bHasImage - aHasImage;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function HomeSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-2xl bg-slate-200" />
      <div className="h-8 w-1/3 rounded-lg bg-slate-200" />
      <div className={GRID_CLASS}>
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={`skeleton-${index}`} className="h-44 rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

export function MarketplaceShell({ language }: MarketplaceShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const router = useRouter();
  const listingsRepository = useMemo(() => getWebListingsRepository(), []);
  const sellersRepository = useMemo(() => getWebSellersRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const addListingHref = isAuthenticated(snapshot) ? `/${resolvedLanguage}/my-ads` : `/${resolvedLanguage}/auth`;

  const [searchText, setSearchText] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityKey>("riyadh");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestListings, setLatestListings] = useState<MarketplaceListing[]>([]);
  const [verifiedSellers, setVerifiedSellers] = useState<SellerProfile[]>([]);
  const [retryToken, setRetryToken] = useState(0);

  const selectedCityLabel = t(`siteLayout.cities.${selectedCity}`);

  useEffect(() => {
    let active = true;
    const query: ListingsQuery = { search: "", status: "all", sort: "newest", page: 1, pageSize: 60 };

    setIsLoading(true);
    setError(null);

    void listingsRepository
      .list(query)
      .then(async (result) => {
        if (!active) {
          return;
        }
        const items = result.items;
        setLatestListings(items);

        const ownerIds = Array.from(new Set(items.map((item) => item.ownerId).filter((id): id is string => typeof id === "string" && id.length > 0))).slice(0, 10);
        if (ownerIds.length === 0) {
          setVerifiedSellers([]);
          return;
        }

        try {
          const sellerProfiles = await Promise.all(ownerIds.map((ownerId) => sellersRepository.getProfile(ownerId, snapshot.user?.id ?? null)));
          if (!active) {
            return;
          }
          setVerifiedSellers(
            sellerProfiles
              .filter((profile): profile is SellerProfile => profile !== null)
              .filter((profile) => profile.isVerified)
              .slice(0, 6)
          );
        } catch {
          if (active) {
            setVerifiedSellers([]);
          }
        }
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : t("marketplace.loadError"));
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listingsRepository, retryToken, sellersRepository, snapshot.user?.id, t]);

  const featuredListings = useMemo(() => sortFeaturedListings(latestListings).slice(0, 12), [latestListings]);

  const cityListings = useMemo(() => {
    return latestListings.filter((listing) => listingMatchesCity(listing, selectedCityLabel)).slice(0, 12);
  }, [latestListings, selectedCityLabel]);

  const categoryKeywordMap = useMemo<Record<MainCategoryKey, string[]>>(
    () => ({
      cars: [t("categories.items.cars").toLowerCase(), "car", "سيارة", "مركبة"],
      realestate: [t("categories.items.realestate").toLowerCase(), "real estate", "عقار"],
      electronics: [t("categories.items.electronics").toLowerCase(), "phone", "laptop", "الكترون", "جوال"],
      services: [t("categories.items.services").toLowerCase(), "service", "خدمة", "صيانة"],
      furniture: [t("categories.items.furniture").toLowerCase(), "furniture", "أثاث"],
      jobs: [t("categories.items.jobs").toLowerCase(), "job", "وظيفة", "employment"]
    }),
    [t]
  );

  const categorySections = useMemo(
    () =>
      MAIN_CATEGORY_KEYS.map((key) => {
        const items = latestListings.filter((listing) => listingMatchesKeywords(listing, categoryKeywordMap[key])).slice(0, 6);
        return {
          key,
          items
        };
      }),
    [categoryKeywordMap, latestListings]
  );

  const onSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const queryText = searchText.trim();
    const cityText = selectedCityLabel.trim();
    const combined = [queryText, cityText].filter((part) => part.length > 0).join(" ");
    router.push(`/${resolvedLanguage}/search${combined ? `?q=${encodeURIComponent(combined)}` : ""}`);
  };

  const hasListings = latestListings.length > 0;

  return (
    <section dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="space-y-6">
      <Card className="overflow-hidden border-brand/20 bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 p-4 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div className="space-y-3">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-10 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t("home.hero.title")}</h1>
            <p className="text-sm leading-7 text-slate-700 sm:text-base">{t("home.hero.subtitle")}</p>
            <div className="flex flex-wrap gap-2">
              {MAIN_CATEGORY_KEYS.map((categoryKey) => (
                <Link
                  key={`hero-cat-${categoryKey}`}
                  href={`/${resolvedLanguage}/categories`}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-brand/40 hover:text-brand"
                >
                  {t(`categories.items.${categoryKey}`)}
                </Link>
              ))}
            </div>
          </div>
          <Card className="border-slate-200 bg-white/95 p-4">
            <form onSubmit={onSubmitSearch} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">{t("siteLayout.header.searchLabel")}</span>
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t("siteLayout.header.searchPlaceholder")}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 transition focus:border-brand focus:ring"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">{t("siteLayout.header.cityLabel")}</span>
                <select
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value as CityKey)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 transition focus:border-brand focus:ring"
                >
                  {CITY_KEYS.map((cityKey) => (
                    <option key={cityKey} value={cityKey}>
                      {t(`siteLayout.cities.${cityKey}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="submit" className="h-11 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-dark">
                  {t("nav.search")}
                </button>
                <Link
                  href={addListingHref}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-brand bg-brand/5 px-3 text-sm font-semibold text-brand transition hover:bg-brand/10"
                >
                  {t("home.hero.addListing")}
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </Card>

      {error ? (
        <Card className="space-y-3 border-red-200">
          <p className="text-sm font-semibold text-red-600">{t("marketplace.loadError")}</p>
          <p className="text-xs text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((current) => current + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {t("common.retry")}
          </button>
        </Card>
      ) : null}

      {isLoading ? <HomeSkeleton /> : null}

      {!isLoading && !error && !hasListings ? (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{t("home.empty.title")}</h2>
          <p className="text-sm text-slate-600">{t("home.empty.description")}</p>
        </Card>
      ) : null}

      {!isLoading && !error && hasListings ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-slate-900">{t("home.sections.featured")}</h2>
              <Link href={`/${resolvedLanguage}/search`} className="text-sm font-semibold text-brand hover:underline">
                {t("home.seeAll")}
              </Link>
            </div>
            <div className={GRID_CLASS}>
              {featuredListings.map((listing) => (
                <ListingCard key={`featured-${listing.id}`} listing={listing} language={resolvedLanguage} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-slate-900">{t("home.sections.latest")}</h2>
              <Link href={`/${resolvedLanguage}/search`} className="text-sm font-semibold text-brand hover:underline">
                {t("home.seeAll")}
              </Link>
            </div>
            <div className={GRID_CLASS}>
              {latestListings.slice(0, 18).map((listing) => (
                <ListingCard key={`latest-${listing.id}`} listing={listing} language={resolvedLanguage} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-slate-900">{t("home.sections.byCity", { city: selectedCityLabel })}</h2>
              <Link href={`/${resolvedLanguage}/search?q=${encodeURIComponent(selectedCityLabel)}`} className="text-sm font-semibold text-brand hover:underline">
                {t("home.seeAll")}
              </Link>
            </div>
            {cityListings.length > 0 ? (
              <div className={GRID_CLASS}>
                {cityListings.map((listing) => (
                  <ListingCard key={`city-${listing.id}`} listing={listing} language={resolvedLanguage} />
                ))}
              </div>
            ) : (
              <Card>
                <p className="text-sm text-slate-600">{t("home.cityEmpty", { city: selectedCityLabel })}</p>
              </Card>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">{t("home.sections.byCategory")}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categorySections.map((section) => (
                <Card key={`cat-section-${section.key}`} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">{t(`categories.items.${section.key}`)}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{section.items.length}</span>
                  </div>
                  {section.items.length > 0 ? (
                    <div className="space-y-2">
                      {section.items.slice(0, 3).map((listing) => (
                        <Link key={`cat-item-${section.key}-${listing.id}`} href={`/${resolvedLanguage}/listing/${listing.id}`} className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-brand/40 hover:text-brand">
                          {listing.title}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{t("home.categoryEmpty")}</p>
                  )}
                </Card>
              ))}
            </div>
          </section>

          {verifiedSellers.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900">{t("home.sections.verifiedSellers")}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {verifiedSellers.map((seller) => (
                  <Link
                    key={`verified-${seller.id}`}
                    href={`/${resolvedLanguage}/seller/${seller.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand/40 hover:shadow-sm"
                  >
                    <p className="text-sm font-semibold text-slate-900">{seller.displayName}</p>
                    <p className="mt-1 text-xs text-slate-500">{seller.city ?? t("sellerProfile.unknownCity")}</p>
                    <p className="mt-2 text-xs font-semibold text-emerald-700">{t("home.verifiedBadge")}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <Card className="border-brand/30 bg-brand/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">{t("home.cta.title")}</h2>
                <p className="text-sm text-slate-600">{t("home.cta.subtitle")}</p>
              </div>
              <Link href={addListingHref} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
                {t("home.cta.action")}
              </Link>
            </div>
          </Card>
        </>
      ) : null}
    </section>
  );
}
