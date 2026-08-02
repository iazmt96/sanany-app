"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type {
  MarketplaceListing,
  PaginatedResult,
  SellerConnection,
  SellerProfile,
  SellerProfileListingsSort,
  SellerProfileListingsTab,
  SellerRating
} from "@sanany/types";
import { canFollowSeller, canRateSeller, computeRatingDistribution, formatMonthYear, formatRelativeTime } from "@sanany/shared";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { ListingCard } from "./listing-card";
import { getWebSellersRepository } from "../lib/sellers-repository";

type SellerProfileShellProps = {
  language: string;
  sellerId: string;
};

type TabKey = "all" | "available" | "sold" | "ratings";

const PAGE_SIZE = 12;
const REPORTED_RATINGS_STORAGE_KEY = "sanany-reported-ratings";

function getRatingStars(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  const full = Math.floor(rounded);
  const half = rounded % 1 !== 0;
  const empty = 5 - full - (half ? 1 : 0);
  return `${"★".repeat(full)}${half ? "☆" : ""}${"·".repeat(Math.max(0, empty))}`;
}

export function SellerProfileShell({ language, sellerId }: SellerProfileShellProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const repository = useMemo(() => getWebSellersRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = tabParam === "available" || tabParam === "sold" || tabParam === "ratings" ? tabParam : "all";
  const [listingsSort, setListingsSort] = useState<SellerProfileListingsSort>("newest");
  const [ratingsSort, setRatingsSort] = useState<"newest" | "highest" | "lowest">("newest");
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });
  const [ratings, setRatings] = useState<PaginatedResult<SellerRating>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [connectionsMode, setConnectionsMode] = useState<"followers" | "following" | null>(null);
  const [followers, setFollowers] = useState<PaginatedResult<SellerConnection>>({ items: [], totalItems: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [following, setFollowing] = useState<PaginatedResult<SellerConnection>>({ items: [], totalItems: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [reportedRatings, setReportedRatings] = useState<Record<string, true>>({});

  const canFollow = canFollowSeller(snapshot.user?.id, sellerId);
  const canRate = canRateSeller(snapshot.user?.id, sellerId);
  const distribution = useMemo(() => computeRatingDistribution(ratings.items), [ratings.items]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, listingsSort, ratingsSort]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(REPORTED_RATINGS_STORAGE_KEY) ?? "{}") as Record<string, true>;
      setReportedRatings(parsed);
    } catch {
      setReportedRatings({});
    }
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const viewerId = snapshot.user?.id ?? null;
    const listingsTab: SellerProfileListingsTab =
      activeTab === "ratings" ? "all" : activeTab === "sold" ? "sold" : activeTab === "available" ? "available" : "all";

    void Promise.all([
      repository.getProfile(sellerId, viewerId),
      repository.listSellerListings({
        sellerId,
        viewerId,
        tab: listingsTab,
        sort: listingsSort,
        page,
        pageSize: PAGE_SIZE
      }),
      repository.listSellerRatings({
        sellerId,
        sort: ratingsSort,
        page,
        pageSize: PAGE_SIZE
      })
    ])
      .then(([profileResult, listingsResult, ratingsResult]) => {
        if (!active) {
          return;
        }
        setProfile(profileResult);
        setListings(listingsResult);
        setRatings(ratingsResult);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("sellerProfile.errorLoad"));
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
  }, [activeTab, listingsSort, page, ratingsSort, repository, sellerId, snapshot.user?.id, t]);

  const setTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    router.replace(next.toString().length > 0 ? `${pathname}?${next.toString()}` : pathname);
  };

  const onToggleFollow = async () => {
    if (!profile || !canFollow || isActionLoading) {
      return;
    }
    if (!snapshot.user?.id) {
      router.push(`/${resolvedLanguage}/auth`);
      return;
    }

    const nextFollow = !profile.isFollowing;
    const previous = profile;
    setIsActionLoading(true);
    setError(null);
    setProfile({
      ...previous,
      isFollowing: nextFollow,
      followersCount: Math.max(0, previous.followersCount + (nextFollow ? 1 : -1))
    });

    try {
      await repository.setFollow(profile.id, snapshot.user.id, nextFollow);
      setActionMessage(nextFollow ? t("sellerProfile.followSuccess") : t("sellerProfile.unfollowSuccess"));
    } catch (followError) {
      setProfile(previous);
      setError(followError instanceof Error ? followError.message : t("sellerProfile.followFailed"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const loadConnections = async (mode: "followers" | "following") => {
    if (!profile || connectionsLoading) {
      return;
    }
    setConnectionsLoading(true);
    setError(null);
    setConnectionsMode(mode);
    try {
      if (mode === "followers") {
        const result = await repository.listFollowers({ sellerId: profile.id, page: 1, pageSize: 10 });
        setFollowers(result);
      } else {
        const result = await repository.listFollowing({ userId: profile.id, page: 1, pageSize: 10 });
        setFollowing(result);
      }
    } catch (connectionsError) {
      setError(connectionsError instanceof Error ? connectionsError.message : t("sellerProfile.connectionsFailed"));
    } finally {
      setConnectionsLoading(false);
    }
  };

  const onSaveRating = async () => {
    if (!profile || !canRate || isActionLoading) {
      return;
    }
    if (!snapshot.user?.id) {
      router.push(`/${resolvedLanguage}/auth`);
      return;
    }
    setIsActionLoading(true);
    setError(null);
    try {
      await repository.saveRating({
        sellerId: profile.id,
        raterId: snapshot.user.id,
        rating: ratingValue,
        comment: ratingComment
      });
      setActionMessage(t("sellerProfile.ratingSaved"));
      setRatingComment("");
      const [profileResult, ratingsResult] = await Promise.all([
        repository.getProfile(profile.id, snapshot.user.id),
        repository.listSellerRatings({ sellerId: profile.id, sort: ratingsSort, page: 1, pageSize: PAGE_SIZE })
      ]);
      setProfile(profileResult);
      setRatings(ratingsResult);
    } catch (ratingError) {
      setError(ratingError instanceof Error ? ratingError.message : t("sellerProfile.ratingSaveFailed"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const onReportRating = (ratingId: string) => {
    if (reportedRatings[ratingId]) {
      return;
    }
    const next: Record<string, true> = { ...reportedRatings, [ratingId]: true };
    setReportedRatings(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REPORTED_RATINGS_STORAGE_KEY, JSON.stringify(next));
    }
    setActionMessage(t("sellerProfile.ratingReportSaved"));
  };

  const onShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile?.displayName ?? t("sellerProfile.pageTitle"), url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setActionMessage(t("sellerProfile.shareSuccess"));
    } catch {
      setActionMessage(t("sellerProfile.shareFailed"));
    }
  };

  const joinedAtLabel =
    profile?.joinedAt ? formatMonthYear(profile.joinedAt, locale, "-") : "-";
  const lastSeenLabel =
    profile?.canShowLastSeen && profile.lastSeenAt
      ? formatRelativeTime(profile.lastSeenAt, locale)
      : null;

  return (
    <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link href={`/${resolvedLanguage}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              {t("sellerProfile.back")}
            </Link>
            <h1 className="text-lg font-bold text-slate-900">{t("sellerProfile.pageTitle")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void onShare()} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {t("sellerProfile.share")}
            </button>
            <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {t("sellerProfile.more")}
            </button>
          </div>
        </header>

        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!isLoading && !error && !profile ? <p className="text-sm text-slate-600">{t("sellerProfile.notFound")}</p> : null}

        {profile ? (
          <>
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Image src={profile.avatarUrl ?? "/placeholders/seller-avatar.svg"} alt={profile.displayName} width={72} height={72} className="h-[72px] w-[72px] rounded-full border border-slate-200 bg-slate-50 object-cover" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{profile.displayName}</h2>
                      {profile.isVerified ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{t("sellerProfile.verifiedShort")}</span> : null}
                    </div>
                    <p className="text-sm text-brand">{profile.username ? `@${profile.username}` : `#${profile.id.slice(0, 8)}`}</p>
                    <p className="text-sm text-slate-600">
                      {t(`sellerProfile.accountType.${profile.accountType}`)} • {profile.city ?? t("sellerProfile.unknownCity")} • {t("sellerProfile.memberSince", { value: joinedAtLabel })}
                    </p>
                    {profile.accountType === "company" && profile.companyBusinessType ? (
                      <p className="text-xs text-slate-600">{t("sellerProfile.companyBusinessType", { value: profile.companyBusinessType })}</p>
                    ) : null}
                    {lastSeenLabel ? <p className="text-xs text-slate-500">{t("sellerProfile.lastSeen", { value: lastSeenLabel })}</p> : null}
                  </div>
                </div>
                <div className="grid min-w-[180px] grid-cols-1 gap-2">
                  {profile.isOwner ? (
                    <button type="button" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">
                      {t("sellerProfile.editProfile")}
                    </button>
                  ) : (
                    <>
                      <button type="button" disabled={isActionLoading || !canFollow} onClick={() => void onToggleFollow()} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                        {profile.isFollowing ? t("sellerProfile.unfollow") : t("sellerProfile.follow")}
                      </button>
                      {snapshot.user?.id ? (
                        <Link href={`/${resolvedLanguage}/chat`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700">
                          {t("sellerProfile.message")}
                        </Link>
                      ) : (
                        <Link href={`/${resolvedLanguage}/auth`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700">
                          {t("sellerProfile.message")}
                        </Link>
                      )}
                      {profile.canShowPhone && profile.phone ? (
                        <a href={`tel:${profile.phone}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700">
                          {t("sellerProfile.call")}
                        </a>
                      ) : null}
                    </>
                  )}
                  <button type="button" onClick={() => void onShare()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    {t("sellerProfile.share")}
                  </button>
                </div>
              </div>

              {profile.bio ? <p className="text-sm leading-6 text-slate-700">{profile.bio}</p> : null}

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-slate-900">{profile.ratingAverage.toFixed(1)}</span>
                <span className="text-amber-500">{getRatingStars(profile.ratingAverage)}</span>
                <button type="button" className="text-brand hover:underline">
                  {t("sellerProfile.ratingCount", { count: profile.ratingCount })}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <button type="button" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-base font-bold text-slate-900">{profile.listingsCount}</div>
                  <div className="text-xs text-slate-500">{t("sellerProfile.stats.listings")}</div>
                </button>
                <button type="button" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-base font-bold text-slate-900">{profile.soldListingsCount}</div>
                  <div className="text-xs text-slate-500">{t("sellerProfile.stats.sold")}</div>
                </button>
                <button type="button" onClick={() => void loadConnections("followers")} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-base font-bold text-slate-900">{profile.followersCount}</div>
                  <div className="text-xs text-slate-500">{t("sellerProfile.stats.followers")}</div>
                </button>
                <button type="button" onClick={() => void loadConnections("following")} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-base font-bold text-slate-900">{profile.followingCount}</div>
                  <div className="text-xs text-slate-500">{t("sellerProfile.stats.following")}</div>
                </button>
                <button type="button" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-base font-bold text-slate-900">{profile.ratingCount}</div>
                  <div className="text-xs text-slate-500">{t("sellerProfile.stats.ratings")}</div>
                </button>
              </div>
            </Card>

            {connectionsMode ? (
              <Card className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {connectionsMode === "followers" ? t("sellerProfile.stats.followers") : t("sellerProfile.stats.following")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setConnectionsMode(null)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                  >
                    {t("common.close")}
                  </button>
                </div>
                {connectionsLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}
                {(connectionsMode === "followers" ? followers.items : following.items).length === 0 && !connectionsLoading ? (
                  <p className="text-sm text-slate-600">{t("sellerProfile.noConnections")}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(connectionsMode === "followers" ? followers.items : following.items).map((connection) => (
                      <Link
                        key={connection.id}
                        href={`/${resolvedLanguage}/seller/${connection.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <p className="font-semibold text-slate-900">{connection.displayName}</p>
                        <p className="text-xs text-slate-500">{connection.username ? `@${connection.username}` : `#${connection.id.slice(0, 8)}`}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ) : null}

            <div className="sticky top-[64px] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              {(["all", "available", "sold", "ratings"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTab(tab)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    activeTab === tab ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {t(`sellerProfile.tabs.${tab}`)}
                </button>
              ))}

              {activeTab === "ratings" ? (
                <button
                  type="button"
                  onClick={() =>
                    setRatingsSort((current) => (current === "newest" ? "highest" : current === "highest" ? "lowest" : "newest"))
                  }
                  className="ms-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                >
                  {t(`sellerProfile.sortRatings.${ratingsSort}`)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setListingsSort((current) =>
                      current === "newest" ? "oldest" : current === "oldest" ? "priceLow" : current === "priceLow" ? "priceHigh" : "newest"
                    )
                  }
                  className="ms-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                >
                  {t(`sellerProfile.sortListings.${listingsSort}`)}
                </button>
              )}
            </div>

            {activeTab === "ratings" ? (
              <div className="grid gap-3">
                <Card className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{t("sellerProfile.ratingDistributionTitle")}</p>
                    <p className="text-xs text-slate-500">{t("sellerProfile.ratingCount", { count: profile.ratingCount })}</p>
                  </div>
                  <div className="space-y-2">
                    {distribution.map((item) => (
                      <div key={item.stars} className="grid grid-cols-[40px_1fr_44px] items-center gap-2">
                        <span className="text-xs text-slate-600">{item.stars}★</span>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-amber-400" style={{ width: `${item.percent}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {canRate ? (
                  <Card className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900">{t("sellerProfile.addRatingTitle")}</p>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingValue(star)}
                          className={`rounded-md border px-2 py-1 text-sm ${ratingValue === star ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-600"}`}
                        >
                          {star}★
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={ratingComment}
                      onChange={(event) => setRatingComment(event.target.value)}
                      className="min-h-[84px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                      placeholder={t("sellerProfile.ratingCommentPlaceholder")}
                    />
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => void onSaveRating()}
                      className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {t("sellerProfile.submitRating")}
                    </button>
                  </Card>
                ) : snapshot.user?.id ? (
                  <Card>
                    <p className="text-sm text-slate-600">{t("sellerProfile.selfRatingBlocked")}</p>
                  </Card>
                ) : (
                  <Card>
                    <p className="text-sm text-slate-600">{t("sellerProfile.signInToRate")}</p>
                  </Card>
                )}

                {ratings.items.length === 0 ? (
                  <Card>
                    <p className="text-sm text-slate-600">{t("sellerProfile.noRatings")}</p>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {ratings.items.map((item) => (
                      <Card key={item.id} className="space-y-2">
                        <p className="text-sm font-semibold text-slate-900">{item.raterName ?? t("sellerProfile.anonymousRater")}</p>
                        <p className="text-xs text-amber-500">{getRatingStars(item.rating)}</p>
                        {item.comment ? <p className="text-sm text-slate-600">{item.comment}</p> : null}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">{formatRelativeTime(item.createdAt, locale)}</p>
                          <button
                            type="button"
                            disabled={Boolean(reportedRatings[item.id])}
                            onClick={() => onReportRating(item.id)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-60"
                          >
                            {reportedRatings[item.id] ? t("sellerProfile.ratingReported") : t("sellerProfile.reportRating")}
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : listings.items.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-600">{profile.isOwner ? t("sellerProfile.emptyMyListings") : t("sellerProfile.emptyListings")}</p>
              </Card>
            ) : (
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {listings.items.map((item) => (
                  <ListingCard key={item.id} listing={item} language={resolvedLanguage} />
                ))}
              </section>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
              >
                {t("common.previous")}
              </button>
              <p className="text-xs text-slate-500">
                {t("common.page", {
                  current: activeTab === "ratings" ? ratings.page : listings.page,
                  total: activeTab === "ratings" ? ratings.totalPages : listings.totalPages
                })}
              </p>
              <button
                type="button"
                disabled={page >= (activeTab === "ratings" ? ratings.totalPages : listings.totalPages)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
              >
                {t("common.next")}
              </button>
            </div>

            {actionMessage ? <p className="text-sm text-slate-600">{actionMessage}</p> : null}
          </>
        ) : null}
      </main>
  );
}
