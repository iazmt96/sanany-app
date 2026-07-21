"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing, SellerProfile } from "@sanany/types";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  REPORTED_LISTINGS_STORAGE_KEY,
  canContactListingOwner,
  formatRelativeTime,
  getRenderableListingImageUrls,
  hasStoredId,
  parseStoredIdList,
  toggleStoredId
} from "@sanany/shared";
import { Badge, Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { resolveListingPriceLabel } from "../lib/listing-price-label";
import { getWebSellersRepository } from "../lib/sellers-repository";
import { ListingCard } from "./listing-card";

type ListingDetailsShellProps = {
  language: string;
  listingId: string;
};

type AvailabilityState = "self" | "sold" | "reserved" | "unavailable" | "expired" | "active";

function parseListingSpecifications(description: string | null): Array<{ label: string; value: string }> {
  if (!description) {
    return [];
  }

  const specs: Array<{ label: string; value: string }> = [];
  for (const line of description.split("\n")) {
    const match = line.trim().match(/^-\s*([^:]+):\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = match[1]?.trim();
    const value = match[2]?.trim();
    if (label && value) {
      specs.push({ label, value });
    }
  }
  return specs;
}

function getDescriptionBody(description: string | null): string | null {
  if (!description) {
    return null;
  }
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("- "));
  return lines.length > 0 ? lines.join("\n") : null;
}

function deriveAvailabilityState(listing: MarketplaceListing, viewerId?: string): AvailabilityState {
  if (viewerId && listing.ownerId === viewerId) {
    return "self";
  }

  if (listing.status === "sold") {
    return "sold";
  }

  const haystack = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  if (haystack.includes("مباع") || haystack.includes("sold")) {
    return "sold";
  }

  if (listing.status === "reserved") {
    return "reserved";
  }

  if (listing.status === "inactive") {
    const ageDays = Math.floor((Date.now() - new Date(listing.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return ageDays > 120 ? "expired" : "unavailable";
  }

  return "active";
}

function statusTone(state: AvailabilityState): string {
  switch (state) {
    case "self":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "sold":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "reserved":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "unavailable":
    case "expired":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-teal-50 text-teal-700 border-teal-200";
  }
}

export function ListingDetailsShell({ language, listingId }: ListingDetailsShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const router = useRouter();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const listingsRepository = useMemo(() => getWebListingsRepository(), []);
  const sellersRepository = useMemo(() => getWebSellersRepository(), []);

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [similarListings, setSimilarListings] = useState<MarketplaceListing[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingAsSold, setIsMarkingAsSold] = useState(false);

  const listingImages = useMemo(() => getRenderableListingImageUrls(listing?.imageUrl ?? null), [listing?.imageUrl]);
  const primaryImage = listingImages[selectedImageIndex] ?? listingImages[0] ?? null;
  const listingStructuredData = useMemo(() => {
    if (!listing) {
      return null;
    }

    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: listing.title,
      description: getDescriptionBody(listing.description) ?? listing.description ?? "",
      image: listingImages[0] ?? undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "SAR",
        price: String(listing.price),
        availability:
          listing.status === "reserved"
            ? "https://schema.org/LimitedAvailability"
          : listing.status === "sold"
            ? "https://schema.org/SoldOut"
            : listing.status === "inactive"
            ? "https://schema.org/Discontinued"
            : "https://schema.org/InStock"
      },
      sku: listing.id
    };

    return JSON.stringify(data);
  }, [listing, listingImages]);
  const availabilityState = listing ? deriveAvailabilityState(listing, snapshot.user?.id) : "active";
  const specificationRows = useMemo(() => parseListingSpecifications(listing?.description ?? null), [listing?.description]);
  const descriptionBody = useMemo(() => getDescriptionBody(listing?.description ?? null), [listing?.description]);
  const listingPriceLabel = useMemo(() => (listing ? resolveListingPriceLabel(listing, t) : null), [listing, t]);
  const advertiserPhone = listing?.ownerPhone?.trim() ?? "";
  const isOwner = Boolean(listing?.ownerId && listing.ownerId === snapshot.user?.id);
  const mapLatitude = listing?.latitude ?? 24.7136;
  const mapLongitude = listing?.longitude ?? 46.6753;
  const mapPreviewUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${mapLatitude},${mapLongitude}&zoom=13&size=900x420&markers=${mapLatitude},${mapLongitude},red-pushpin`;
  const contactPermissions = canContactListingOwner({
    viewerId: snapshot.user?.id,
    ownerId: listing?.ownerId,
    ownerPhone: advertiserPhone
  });

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    void listingsRepository
      .getById(listingId)
      .then((result) => {
        if (!active) {
          return;
        }
        setListing(result);
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
  }, [listingId, listingsRepository, t]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [listing?.id]);

  useEffect(() => {
    if (!listing) {
      return;
    }

    try {
      const favoritesRaw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const reportsRaw = window.localStorage.getItem(REPORTED_LISTINGS_STORAGE_KEY);
      const viewsRaw = window.localStorage.getItem(LISTING_VIEWS_STORAGE_KEY);
      const nextViews = [listing.id, ...parseStoredIdList(viewsRaw).filter((item) => item !== listing.id)].slice(0, 18);
      window.localStorage.setItem(LISTING_VIEWS_STORAGE_KEY, JSON.stringify(nextViews));
      setIsFavorite(hasStoredId(favoritesRaw, listing.id));
      setIsReported(hasStoredId(reportsRaw, listing.id));
    } catch {
      setIsFavorite(false);
      setIsReported(false);
    }
  }, [listing]);

  useEffect(() => {
    if (!listing?.ownerId) {
      setSeller(null);
      return;
    }

    let active = true;
    void sellersRepository
      .getProfile(listing.ownerId, snapshot.user?.id ?? null)
      .then((profile) => {
        if (active) {
          setSeller(profile);
        }
      })
      .catch(() => {
        if (active) {
          setSeller(null);
        }
      });

    return () => {
      active = false;
    };
  }, [listing?.ownerId, sellersRepository, snapshot.user?.id]);

  useEffect(() => {
    if (!listing) {
      setSimilarListings([]);
      return;
    }

    let active = true;
    const queryText = listing.title
      .split(/\s+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 2)
      .slice(0, 3)
      .join(" ");

    void listingsRepository
      .list({
        search: queryText,
        status: "all",
        sort: "newest",
        page: 1,
        pageSize: 18
      })
      .then((result) => {
        if (!active) {
          return;
        }
        setSimilarListings(
          result.items
            .filter((item) => item.id !== listing.id)
            .slice(0, 6)
        );
      })
      .catch(() => {
        if (active) {
          setSimilarListings([]);
        }
      });

    return () => {
      active = false;
    };
  }, [listing, listingsRepository]);

  const onToggleFavorite = () => {
    if (!listing) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const next = toggleStoredId(raw, listing.id);
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, next.serialized);
      setIsFavorite(next.isSelected);
      setActionMessage(next.isSelected ? t("marketplace.detail.favoriteAdded") : t("marketplace.detail.favoriteRemoved"));
    } catch {
      setIsFavorite((current) => !current);
    }
  };

  const onShareListing = async () => {
    if (!listing) {
      return;
    }

    const shareUrl = `${window.location.origin}/${resolvedLanguage}/listing/${listing.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text: listing.description ?? listing.title, url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setActionMessage(t("marketplace.detail.shared"));
    } catch {
      setActionMessage(t("marketplace.detail.shareFailed"));
    }
  };

  const onReportListing = () => {
    if (!listing) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(REPORTED_LISTINGS_STORAGE_KEY);
      const ids = parseStoredIdList(raw);
      if (!ids.includes(listing.id)) {
        ids.push(listing.id);
        window.localStorage.setItem(REPORTED_LISTINGS_STORAGE_KEY, JSON.stringify(ids));
      }
      setIsReported(true);
      setActionMessage(t("marketplace.detail.reported"));
    } catch {
      setIsReported(true);
    }
  };

  const onToggleFollow = async () => {
    if (!snapshot.user?.id || !seller || seller.isOwner || isFollowLoading) {
      return;
    }

    const shouldFollow = !seller.isFollowing;
    const previous = seller;
    setIsFollowLoading(true);
    setSeller({
      ...previous,
      isFollowing: shouldFollow,
      followersCount: Math.max(0, previous.followersCount + (shouldFollow ? 1 : -1))
    });

    try {
      await sellersRepository.setFollow(previous.id, snapshot.user.id, shouldFollow);
      setActionMessage(shouldFollow ? t("sellerProfile.followSuccess") : t("sellerProfile.unfollowSuccess"));
    } catch (followError) {
      setSeller(previous);
      setActionMessage(followError instanceof Error ? followError.message : t("sellerProfile.followFailed"));
    } finally {
      setIsFollowLoading(false);
    }
  };

  const onDeleteListing = async () => {
    if (!listing || !snapshot.user?.id || listing.ownerId !== snapshot.user.id || isDeleting) {
      return;
    }

    const confirmed = window.confirm(t("marketplace.detail.deleteConfirmMessage"));
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setActionMessage(null);
    try {
      await listingsRepository.deleteById(listing.id, snapshot.user.id);
      router.push(`/${resolvedLanguage}/my-ads`);
      router.refresh();
    } catch (deleteError) {
      setActionMessage(deleteError instanceof Error ? deleteError.message : t("marketplace.detail.deleteFailed"));
      setIsDeleting(false);
    }
  };

  const onMarkAsSold = async () => {
    if (!listing || !snapshot.user?.id || listing.ownerId !== snapshot.user.id || isMarkingAsSold || listing.status === "sold") {
      return;
    }

    const confirmed = window.confirm(t("marketplace.detail.markAsSoldConfirmMessage"));
    if (!confirmed) {
      return;
    }

    setIsMarkingAsSold(true);
    setActionMessage(null);
    try {
      await listingsRepository.publishDraft({
        id: listing.id,
        ownerId: snapshot.user.id,
        offerType: listing.offerType ?? null,
        categorySlug: listing.categorySlug ?? null,
        title: listing.title,
        description: listing.description ?? "-",
        price: listing.price,
        imageUrl: listing.imageUrl ?? undefined,
        status: "sold",
        locationName: listing.locationName ?? undefined,
        latitude: listing.latitude ?? undefined,
        longitude: listing.longitude ?? undefined,
        ownerPhone: listing.ownerPhone ?? undefined
      });
      setListing((current) => (current ? { ...current, status: "sold" } : current));
      setActionMessage(t("marketplace.detail.markAsSoldSuccess"));
    } catch (markError) {
      setActionMessage(markError instanceof Error ? markError.message : t("marketplace.detail.markAsSoldFailed"));
    } finally {
      setIsMarkingAsSold(false);
    }
  };

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-8">
        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="h-80 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-36 animate-pulse rounded-xl bg-slate-200" />
            </div>
            <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
          </div>
        ) : null}

        {error ? (
          <Card className="space-y-2 border-red-200">
            <p className="text-sm font-semibold text-red-600">{t("marketplace.loadError")}</p>
            <p className="text-xs text-slate-500">{error}</p>
          </Card>
        ) : null}

        {!isLoading && !error && !listing ? (
          <Card>
            <p className="text-sm text-slate-600">{t("marketplace.detail.notFound")}</p>
          </Card>
        ) : null}

        {listing ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            {listingStructuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listingStructuredData }} /> : null}
            <section className="space-y-5">
              <Card className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {primaryImage ? (
                    <div className="relative h-80 w-full">
                      <Image src={primaryImage} alt={listing.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 70vw" />
                      <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-900/60 px-2.5 py-1 text-xs font-semibold text-white">
                          {t("marketplace.detail.imagesCount", { count: Math.max(listingImages.length, 1) })}
                        </span>
                        <Badge variant={listing.status}>{t(`marketplace.status.${listing.status}`)}</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-80 items-center justify-center text-sm text-slate-500">{t("marketplace.detail.noImage")}</div>
                  )}
                </div>
                {listingImages.length > 1 ? (
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                    {listingImages.map((url, index) => (
                      <button
                        key={`${listing.id}-image-${index}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative overflow-hidden rounded-lg border ${
                          selectedImageIndex === index ? "border-brand" : "border-slate-200"
                        }`}
                      >
                        <span className="sr-only">{t("marketplace.detail.imageThumb", { index: index + 1 })}</span>
                        <Image src={url} alt="" width={88} height={72} className="h-16 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>

              <Card className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {isOwner ? (
                    <>
                      <Link
                        href={`/${resolvedLanguage}/my-ads`}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white"
                      >
                        {t("marketplace.detail.editAction")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void onMarkAsSold()}
                        disabled={isMarkingAsSold || listing.status === "sold"}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                      >
                        {isMarkingAsSold ? t("common.loading") : t("marketplace.detail.markAsSoldAction")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onShareListing()}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                      >
                        {t("marketplace.detail.share")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteListing()}
                        disabled={isDeleting}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-4 text-sm font-semibold text-rose-700 disabled:opacity-60"
                      >
                        {isDeleting ? t("common.loading") : t("marketplace.detail.deleteAction")}
                      </button>
                    </>
                  ) : (
                    <>
                      {contactPermissions.canCall ? (
                        <a href={`tel:${advertiserPhone}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">
                          {t("marketplace.detail.call")}
                        </a>
                      ) : null}
                      {contactPermissions.canChat ? (
                        <a
                          href={`https://wa.me/${advertiserPhone.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-brand bg-brand/5 px-4 text-sm font-semibold text-brand"
                        >
                          {t("marketplace.detail.chat")}
                        </a>
                      ) : null}
                      {listing.ownerId ? (
                        <Link
                          href={`/${resolvedLanguage}/chat?listingId=${listing.id}&sellerId=${listing.ownerId}`}
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                        >
                          {t("sellerProfile.message")}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={onToggleFavorite}
                        className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold ${
                          isFavorite ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {t("marketplace.detail.favorite")}
                      </button>
                      <button type="button" onClick={() => void onShareListing()} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
                        {t("marketplace.detail.share")}
                      </button>
                      <button
                        type="button"
                        onClick={onReportListing}
                        className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold ${
                          isReported ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {t("marketplace.detail.report")}
                      </button>
                    </>
                  )}
                </div>
                {!contactPermissions.canCall && !contactPermissions.canChat && !isOwner ? (
                  <p className="text-xs text-slate-500">{t("marketplace.detail.contactUnavailable")}</p>
                ) : null}
              </Card>

              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-2xl font-bold text-slate-900">{listing.title}</h2>
                  <Badge variant={listing.status}>{t(`marketplace.status.${listing.status}`)}</Badge>
                </div>

                <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(availabilityState)}`}>
                  {t(`marketplace.detail.availability.${availabilityState}`)}
                </div>

                <p className="text-sm text-slate-500">{t("marketplace.postedAt", { value: formatRelativeTime(listing.createdAt, resolvedLanguage) })}</p>

                <section className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{t("marketplace.detail.description")}</h3>
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{descriptionBody ?? t("marketplace.detail.noDescription")}</p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{t("marketplace.detail.specificationsTitle")}</h3>
                  {specificationRows.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {specificationRows.map((row, index) => (
                        <div key={`${row.label}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <p className="font-semibold text-slate-700">{row.label}</p>
                          <p className="text-slate-600">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">{t("marketplace.detail.noSpecifications")}</p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{t("marketplace.detail.locationTitle")}</h3>
                  <p className="text-sm text-slate-700">{listing.locationName ?? t("marketplace.detail.approximateLocation")}</p>
                  <p className="text-xs text-slate-500">{t("marketplace.detail.locationPrivacyHint")}</p>
                  {listing.locationName ? (
                    <a
                      href={`https://www.google.com/maps?q=${encodeURIComponent(listing.locationName)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-sm font-semibold text-brand hover:underline"
                    >
                      {t("marketplace.detail.openInMaps")}
                    </a>
                  ) : null}
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(listing.locationName ?? `${mapLatitude},${mapLongitude}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block overflow-hidden rounded-xl border border-slate-200"
                  >
                    <img src={mapPreviewUrl} alt={t("marketplace.detail.locationTitle")} className="h-44 w-full object-cover" loading="lazy" />
                    <span className="absolute inset-x-3 bottom-3 inline-flex items-center justify-center rounded-lg bg-slate-900/65 px-3 py-2 text-xs font-semibold text-white">
                      {t("marketplace.detail.openInMaps")}
                    </span>
                  </a>
                </section>
              </Card>

              <Card className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">{t("marketplace.detail.similarAdsTitle")}</h3>
                  <p className="text-sm text-slate-600">{t("marketplace.detail.similarAdsSubtitle")}</p>
                </div>
                {similarListings.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {similarListings.map((item) => (
                      <ListingCard key={`similar-${item.id}`} listing={item} language={resolvedLanguage} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">{t("marketplace.detail.noSimilarAds")}</p>
                )}
              </Card>
            </section>

            <aside className="space-y-4">
              <Card className="sticky top-24 space-y-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
                    <span>{listingPriceLabel}</span>
                    {listing.status === "sold" ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {t("marketplace.status.sold")}
                      </span>
                    ) : null}
                  </div>
                </div>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">{t("marketplace.detail.advertiserTitle")}</h3>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{seller?.displayName ?? t("marketplace.detail.advertiserName", { id: listing.id.slice(0, 4).toUpperCase() })}</p>
                        <p className="text-xs text-slate-500">{t("marketplace.detail.advertiserRole")}</p>
                        {seller ? (
                          <p className="mt-2 text-xs text-amber-600">
                            {seller.ratingAverage.toFixed(1)} ★ ({t("sellerProfile.ratingCount", { count: seller.ratingCount })})
                          </p>
                        ) : null}
                        {listing.ownerId ? (
                          <Link href={`/${resolvedLanguage}/seller/${listing.ownerId}`} className="mt-2 inline-flex text-xs font-semibold text-brand hover:underline">
                            {t("sellerProfile.pageTitle")}
                          </Link>
                        ) : null}
                      </div>
                      {!isOwner ? (
                        <div className="flex items-center gap-2">
                          {contactPermissions.canCall ? (
                            <a href={`tel:${advertiserPhone}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-brand/30 bg-brand/5 px-3 text-xs font-semibold text-brand">
                              {t("marketplace.detail.call")}
                            </a>
                          ) : null}
                          {contactPermissions.canChat ? (
                            <a
                              href={`https://wa.me/${advertiserPhone.replace(/[^\d]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-brand/30 bg-brand/5 px-3 text-xs font-semibold text-brand"
                            >
                              {t("marketplace.detail.chat")}
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                {!seller?.isOwner && seller ? (
                  <button
                    type="button"
                    onClick={() => void onToggleFollow()}
                    disabled={isFollowLoading}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {seller.isFollowing ? t("sellerProfile.unfollow") : t("sellerProfile.follow")}
                  </button>
                ) : null}

                <div className="grid gap-2">
                  {actionMessage ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{actionMessage}</p>
                  ) : null}
                  {!isOwner && !contactPermissions.canCall && !contactPermissions.canChat ? (
                    <p className="text-xs text-slate-500">{t("marketplace.detail.contactUnavailable")}</p>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-900">{t("marketplace.detail.listingNumber")}:</span> {listing.id}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">{t("marketplace.detail.listingDate")}:</span>{" "}
                    {new Date(listing.createdAt).toLocaleDateString(resolvedLanguage === "ar" ? "ar-SA" : "en-US")}
                  </p>
                </div>
              </Card>
            </aside>
          </div>
        ) : null}
      </main>
    </RequireAuth>
  );
}
