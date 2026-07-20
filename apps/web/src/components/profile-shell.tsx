"use client";

import { MyAdsShell } from "./my-ads-shell";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing, PaginatedResult, SellerProfile } from "@sanany/types";
import { FAVORITES_STORAGE_KEY, getPrimaryListingImageUrl, parseStoredIdList } from "@sanany/shared";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { getWebSellersRepository } from "../lib/sellers-repository";

type ProfileShellProps = {
  language: string;
  tab?: string | null;
  tapPaymentReturn?: { tapId: string; listingId: string } | null;
};

type ProfileStatsState = {
  active: number;
  drafts: number;
  sold: number;
  favorites: number;
};

const LISTING_PAGE_SIZE = 9;

function formatMemberSince(value: string, language: string): string {
  try {
    return new Date(value).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long"
    });
  } catch {
    return value;
  }
}

function formatPublishedDate(value: string, language: string): string {
  try {
    return new Date(value).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return value;
  }
}

function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M10 1.75a1 1 0 0 1 .64.23l1.66 1.39 2.12.18a1 1 0 0 1 .84.6l.82 1.97 1.72 1.27a1 1 0 0 1 .37 1.02l-.56 2.05.56 2.05a1 1 0 0 1-.37 1.02l-1.72 1.27-.82 1.97a1 1 0 0 1-.84.6l-2.12.18-1.66 1.39a1 1 0 0 1-1.28 0l-1.66-1.39-2.12-.18a1 1 0 0 1-.84-.6l-.82-1.97-1.72-1.27a1 1 0 0 1-.37-1.02l.56-2.05-.56-2.05a1 1 0 0 1 .37-1.02l1.72-1.27.82-1.97a1 1 0 0 1 .84-.6l2.12-.18 1.66-1.39A1 1 0 0 1 10 1.75Zm2.78 6.74a.75.75 0 0 0-1.06-1.06l-2.47 2.47-.97-.97a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3-3Z" />
      </svg>
      {label}
    </span>
  );
}

export function ProfileShell({ language, tab = null, tapPaymentReturn = null }: ProfileShellProps) {
  const { t } = useTranslation();
  const { accountProfile, snapshot } = useAuth();
  const searchParams = useSearchParams();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const listingsRepository = useMemo(() => getWebListingsRepository(), []);
  const sellersRepository = useMemo(() => getWebSellersRepository(), []);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<ProfileStatsState>({
    active: 0,
    drafts: 0,
    sold: 0,
    favorites: 0
  });
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsData, setListingsData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: LISTING_PAGE_SIZE,
    totalPages: 1
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const userId = snapshot.user?.id;
    if (!userId) {
      return;
    }

    let active = true;
    setIsLoadingProfile(true);
    setErrorMessage(null);

    const load = async () => {
      const parsedFavoriteIds = parseStoredIdList(window.localStorage.getItem(FAVORITES_STORAGE_KEY));
      const [profileResult, activeResult, draftsResult, soldResult] = await Promise.all([
        sellersRepository.getProfile(userId, userId),
        listingsRepository.listByOwner(userId, { search: "", status: "available", sort: "newest", page: 1, pageSize: 1 }),
        listingsRepository.listByOwner(userId, { search: "", status: "draft", sort: "newest", page: 1, pageSize: 1 }),
        listingsRepository.listByOwner(userId, { search: "", status: "reserved", sort: "newest", page: 1, pageSize: 1 })
      ]);

      if (!active) {
        return;
      }

      setFavoriteIds(parsedFavoriteIds);
      setProfile(profileResult);
      setStats({
        active: activeResult.totalItems,
        drafts: draftsResult.totalItems,
        sold: soldResult.totalItems,
        favorites: parsedFavoriteIds.length
      });
    };

    void load()
      .catch((requestError) => {
        if (active) {
          setErrorMessage(requestError instanceof Error ? requestError.message : t("profile.errorLoad"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listingsRepository, sellersRepository, snapshot.user?.id, t]);

  useEffect(() => {
    const userId = snapshot.user?.id;
    if (!userId) {
      return;
    }

    let active = true;
    setIsLoadingListings(true);

    void listingsRepository
      .listByOwner(userId, {
        search: "",
        status: "all",
        sort: "newest",
        page: listingsPage,
        pageSize: LISTING_PAGE_SIZE
      })
      .then((result) => {
        if (!active) {
          return;
        }
        setListingsData(result);
      })
      .catch((requestError) => {
        if (active) {
          setErrorMessage(requestError instanceof Error ? requestError.message : t("profile.errorLoad"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingListings(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listingsPage, listingsRepository, snapshot.user?.id, t]);

  const trustScore = profile?.ratingCount ? Math.min(100, Math.max(0, Math.round(profile.ratingAverage * 20))) : null;
  const accountWebsite = accountProfile?.website ?? null;
  const editLink = `/${resolvedLanguage}/profile/edit`;
  const isAdsTab = tab === "ads";
  const profileTabHref = `/${resolvedLanguage}/profile`;
  const adsTabHref = `/${resolvedLanguage}/profile?tab=ads`;

  const quickActions = [
    { id: "myAds", href: adsTabHref, label: t("profile.dashboard.quickActions.items.myAds") },
    { id: "soldAds", href: `${adsTabHref}&section=sold`, label: t("profile.dashboard.quickActions.items.soldAds") },
    { id: "drafts", href: `${adsTabHref}&section=drafts`, label: t("profile.dashboard.quickActions.items.drafts") },
    { id: "commission", href: `${adsTabHref}&section=sold`, label: t("profile.dashboard.quickActions.items.commission") },
    { id: "savedSearches", href: `/${resolvedLanguage}/search`, label: t("profile.dashboard.quickActions.items.savedSearches") },
    { id: "verification", href: `/${resolvedLanguage}/profile/verify`, label: t("profile.dashboard.quickActions.items.verification") },
    { id: "settings", href: editLink, label: t("profile.dashboard.quickActions.items.settings") }
  ] as const;

  return (
    <RequireAuth language={resolvedLanguage}>
      <div dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="space-y-5 overflow-x-hidden sm:space-y-6">
        {/* Tab switcher */}
        <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Link
            href={profileTabHref}
            className={`flex-1 py-3 text-center text-sm font-semibold transition ${
              !isAdsTab ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {t("profile.pageTitle")}
          </Link>
          <Link
            href={adsTabHref}
            className={`flex-1 py-3 text-center text-sm font-semibold transition ${
              isAdsTab ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {t("nav.myAds")}
          </Link>
        </div>

        {isAdsTab ? (
          <MyAdsShell language={resolvedLanguage} tapPaymentReturn={tapPaymentReturn ?? null} />
        ) : (
          <>
            {searchParams.get("saved") === "1" ? (
              <Card>
                <p className="text-sm font-semibold text-emerald-700">{t("profile.edit.success")}</p>
              </Card>
            ) : null}

            {isLoadingProfile ? <Card><p className="text-sm text-slate-600">{t("common.loading")}</p></Card> : null}
            {errorMessage ? <Card><p className="text-sm text-rose-600">{errorMessage}</p></Card> : null}

        {!isLoadingProfile && profile ? (
          <>
            <Card className="relative space-y-5 sm:space-y-6">
              {profile.isOwner ? (
                <Link
                  href={editLink}
                  aria-label={t("profile.dashboard.header.editAriaLabel")}
                  className="absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-brand/40 hover:text-brand sm:end-5 sm:top-5 sm:h-9 sm:w-9"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 20h4l10.6-10.6a1.8 1.8 0 0 0 0-2.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 0L4 16v4Z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                </Link>
              ) : null}

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {profile.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt={profile.displayName} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 via-cyan-50 to-slate-100 text-3xl font-bold text-slate-500">
                      {(profile.displayName || t("profile.accountNameFallback")).slice(0, 1)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="break-words text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{profile.displayName}</h1>
                    {profile.isVerified ? <VerifiedBadge label={t("home.verifiedBadge")} /> : null}
                  </div>
                  <p className="break-all text-sm font-medium text-slate-500">@{profile.username ?? t("home.seller.defaultUsername")}</p>
                  <p className="max-w-full whitespace-pre-line text-sm leading-6 text-slate-700 sm:max-w-3xl">
                    {profile.bio?.trim() || t("profile.dashboard.header.bioFallback")}
                  </p>
                  {accountWebsite ? (
                    <a
                      href={accountWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full break-all text-sm font-semibold text-brand hover:text-brand-dark"
                    >
                      {accountWebsite}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {t("profile.header.memberSince", { value: formatMemberSince(profile.joinedAt, resolvedLanguage) })}
                    </span>
                    {profile.city ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {t("profile.dashboard.header.location", { value: profile.city })}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {trustScore === null
                        ? t("profile.dashboard.header.trustScorePending")
                        : t("profile.dashboard.header.trustScoreValue", { value: trustScore })}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">{t("profile.dashboard.statsTitle")}</h2>
              <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{t("profile.dashboard.stats.activeAds")}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{stats.active}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{t("profile.dashboard.stats.soldAds")}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{stats.sold}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{t("profile.dashboard.stats.drafts")}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{stats.drafts}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{t("profile.dashboard.stats.favorites")}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{stats.favorites}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{t("profile.dashboard.stats.profileViews")}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-700">{t("profile.dashboard.futureReady")}</p>
                </div>
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{t("profile.dashboard.stats.trustScore")}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-700">{t("profile.dashboard.futureReady")}</p>
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">{t("profile.dashboard.quickActions.title")}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {quickActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-brand/35 hover:text-brand"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">{t("profile.dashboard.ads.title")}</h2>
                <p className="text-sm text-slate-600">{t("profile.dashboard.ads.subtitle")}</p>
              </div>

              {isLoadingListings ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}

              {!isLoadingListings && listingsData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                  <svg aria-hidden="true" viewBox="0 0 96 96" className="h-20 w-20 text-slate-300" fill="none">
                    <rect x="12" y="18" width="72" height="60" rx="12" stroke="currentColor" strokeWidth="4" />
                    <circle cx="35" cy="40" r="6" stroke="currentColor" strokeWidth="4" />
                    <path d="M24 66 44 50l12 10 16-14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-base font-semibold text-slate-700">{t("profile.dashboard.ads.emptyTitle")}</p>
                  <Link href={adsTabHref} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                    {t("profile.dashboard.ads.addAction")}
                  </Link>
                </div>
              ) : null}

              {!isLoadingListings && listingsData.items.length > 0 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {listingsData.items.map((listing) => {
                      const imageUrl = getPrimaryListingImageUrl(listing.imageUrl);
                      const isFavorite = favoriteIds.includes(listing.id);
                      return (
                        <article key={listing.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <Link href={`/${resolvedLanguage}/listing/${listing.id}`} className="relative block h-44 w-full bg-slate-100">
                            {imageUrl ? (
                              <Image src={imageUrl} alt={listing.title} fill className="object-cover" />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-slate-100 to-cyan-50" />
                            )}
                            <span className="absolute start-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {t(`marketplace.status.${listing.status}`)}
                            </span>
                          </Link>
                          <div className="space-y-3 p-3.5 sm:p-4">
                            <p className="text-lg font-extrabold text-slate-900">{t("marketplace.pricePerDay", { value: listing.price })}</p>
                            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{listing.title}</h3>
                            <div className="space-y-1 text-xs text-slate-500">
                              <p>{listing.locationName ?? t("marketplace.detail.approximateLocation")}</p>
                              <p>{t("profile.dashboard.ads.card.published", { value: formatPublishedDate(listing.createdAt, resolvedLanguage) })}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                                <p className="text-[11px] text-slate-500">{t("profile.dashboard.ads.card.views")}</p>
                                <p className="font-semibold text-slate-800">{t("profile.dashboard.ads.card.metricUnavailable")}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                                <p className="text-[11px] text-slate-500">{t("profile.dashboard.ads.card.favorites")}</p>
                                <p className="font-semibold text-slate-800">{isFavorite ? "1" : "0"}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                                <p className="text-[11px] text-slate-500">{t("profile.dashboard.ads.card.chats")}</p>
                                <p className="font-semibold text-slate-800">{t("profile.dashboard.ads.card.metricUnavailable")}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                                <p className="text-[11px] text-slate-500">{t("profile.dashboard.ads.card.status")}</p>
                                <p className="font-semibold text-slate-800">{t(`marketplace.status.${listing.status}`)}</p>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {listingsData.totalPages > 1 ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <button
                        type="button"
                        disabled={listingsPage <= 1}
                        onClick={() => setListingsPage((current) => Math.max(1, current - 1))}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
                      >
                        {t("common.previous")}
                      </button>
                      <p className="text-xs text-slate-500">
                        {t("common.page", { current: listingsData.page, total: listingsData.totalPages })}
                      </p>
                      <button
                        type="button"
                        disabled={listingsPage >= listingsData.totalPages}
                        onClick={() => setListingsPage((current) => Math.min(listingsData.totalPages, current + 1))}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
                      >
                        {t("common.next")}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </Card>
          </>
        ) : null}
          </>
        )}
      </div>
    </RequireAuth>
  );
}
