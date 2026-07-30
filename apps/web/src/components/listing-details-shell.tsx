"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ListingSalePayment, MarketplaceCommissionSettings, MarketplaceListing, SellerProfile } from "@sanany/types";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  REPORTED_LISTINGS_STORAGE_KEY,
  canContactListingOwner,
  formatRelativeTime,
  getRenderableListingImageUrls,
  hasStoredId,
  parseStoredIdList,
  shouldShowSaleCompletionAction,
  toggleStoredId
} from "@sanany/shared";
import { Badge, Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { getWebSupabaseClient } from "../lib/supabase-client";
import { resolveListingPriceLabel } from "../lib/listing-price-label";
import { getWebSellersRepository } from "../lib/sellers-repository";
import { ListingCard } from "./listing-card";
import { MyAdsSaleCompletion } from "./my-ads-sale-completion";

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
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingAsSold, setIsMarkingAsSold] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCommissionFlowOpen, setIsCommissionFlowOpen] = useState(false);
  const [salePayment, setSalePayment] = useState<ListingSalePayment | null>(null);
  const [commissionSettings, setCommissionSettings] = useState<MarketplaceCommissionSettings | null>(null);
  const mediaCarouselRef = useRef<HTMLDivElement | null>(null);
  const previewCarouselRef = useRef<HTMLDivElement | null>(null);

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
    setPreviewImageIndex(0);
  }, [listing?.id]);

  useEffect(() => {
    if (!listing?.id || !snapshot.user?.id || listing.ownerId !== snapshot.user.id) {
      return;
    }
    let active = true;
    void Promise.all([
      listingsRepository.getCommissionSettings(),
      listingsRepository.listSalePaymentsBySeller(snapshot.user.id)
    ]).then(([settings, payments]) => {
      if (!active) return;
      setCommissionSettings(settings);
      setSalePayment(payments.find((p) => p.listingId === listing.id) ?? null);
    }).catch(() => { /* non-critical */ });
    return () => { active = false; };
  }, [listing?.id, listing?.ownerId, snapshot.user?.id, listingsRepository]);

  const updateCarouselIndex = (element: HTMLDivElement, setIndex: (value: number) => void) => {
    if (listingImages.length <= 1) {
      setIndex(0);
      return;
    }
    const slideWidth = element.clientWidth;
    if (slideWidth <= 0) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(listingImages.length - 1, Math.round(element.scrollLeft / slideWidth)));
    setIndex(nextIndex);
  };

  const openImagePreview = () => {
    if (listingImages.length === 0) {
      return;
    }
    setPreviewImageIndex(selectedImageIndex);
    setIsImagePreviewOpen(true);
  };

  useEffect(() => {
    if (!isImagePreviewOpen || !previewCarouselRef.current) {
      return;
    }
    const container = previewCarouselRef.current;
    container.scrollTo({ left: previewImageIndex * container.clientWidth, behavior: "auto" });
  }, [isImagePreviewOpen, previewImageIndex]);

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

  const onRefreshListing = async () => {
    if (!listing || !snapshot.user?.id || listing.ownerId !== snapshot.user.id || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setActionMessage(null);
    try {
      const supabase = getWebSupabaseClient();
      const { error: refreshError } = await supabase
        .from("listings")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", listing.id)
        .eq("owner_id", snapshot.user.id);
      if (refreshError) throw refreshError;
      setListing((current) => (current ? { ...current, updatedAt: new Date().toISOString() } : current));
      setActionMessage(t("marketplace.detail.updatedSuccess"));
    } catch (refreshError) {
      setActionMessage(refreshError instanceof Error ? refreshError.message : t("marketplace.detail.updateFailed"));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-8 pb-24 md:pb-8">
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
              {/* Gallery + actions merged in one card */}
              <Card className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {primaryImage ? (
                    <button type="button" onClick={openImagePreview} className="relative block h-80 w-full cursor-zoom-in text-start">
                      <div
                        ref={mediaCarouselRef}
                        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        onScroll={(event) => updateCarouselIndex(event.currentTarget, setSelectedImageIndex)}
                      >
                        {listingImages.map((url, index) => (
                          <div key={`${listing.id}-image-${index}`} className="relative h-full w-full shrink-0 snap-center">
                            <Image src={url} alt={listing.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 70vw" />
                          </div>
                        ))}
                      </div>
                      <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-900/60 px-2.5 py-1 text-xs font-semibold text-white">
                          {t("marketplace.detail.imagesCount", { count: Math.max(listingImages.length, 1) })}
                        </span>
                        <Badge variant={listing.status}>{t(`marketplace.status.${listing.status}`)}</Badge>
                      </div>
                      {listingImages.length > 1 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
                          {listingImages.map((_, index) => (
                            <span
                              key={`${listing.id}-dot-${index}`}
                              className={`rounded-full transition-all ${selectedImageIndex === index ? "h-1.5 w-5 bg-white" : "h-1.5 w-1.5 bg-white/55"}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </button>
                  ) : (
                    <div className="flex h-80 items-center justify-center text-sm text-slate-500">{t("marketplace.detail.noImage")}</div>
                  )}
                </div>

                {/* Actions row — owner controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner ? (
                    <>
                      {/* Primary: Edit */}
                      <Link
                        href={`/${resolvedLanguage}/my-ads`}
                        className="inline-flex h-9 items-center gap-1.5 justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                          <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                        </svg>
                        {t("marketplace.detail.editAction")}
                      </Link>

                      {/* Secondary: Refresh/bump */}
                      <button
                        type="button"
                        onClick={() => void onRefreshListing()}
                        disabled={isRefreshing}
                        title={t("marketplace.detail.updateAction")}
                        className="inline-flex h-9 items-center gap-1.5 justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`}>
                          <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
                        </svg>
                        {t("marketplace.detail.updateAction")}
                      </button>

                      {/* Secondary: Commission transfer */}
                      {listing && shouldShowSaleCompletionAction(listing, salePayment ? [salePayment] : []) && (
                        <button
                          type="button"
                          onClick={() => setIsCommissionFlowOpen(true)}
                          className="inline-flex h-9 items-center gap-1.5 justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                            <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.576Z" />
                            <path fillRule="evenodd" d="M9.99 1.012a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM4.99 10c0-2.986 2.236-5.498 5.25-5.93V3.07a.75.75 0 0 1 1.5 0v1.04a7.463 7.463 0 0 1 1.603.607.75.75 0 0 1-.7 1.33 5.963 5.963 0 0 0-1.403-.516v2.72c1.65.437 3.25 1.355 3.25 3.249 0 1.894-1.6 2.812-3.25 3.249V15.93a.75.75 0 0 1-1.5 0v-1.181a7.463 7.463 0 0 1-2.205-.83.75.75 0 0 1 .784-1.276c.47.29.996.5 1.421.603V10.82c-1.65-.437-3.25-1.355-3.25-3.25V7.5a.75.75 0 0 1 1.5 0v.07c.348-.044.7-.044 1.047 0a3.86 3.86 0 0 1 .453.081V5.427c-.508.122-.963.315-1.353.578C5.38 6.425 4.99 7.148 4.99 8.07v.07c0 .87.367 1.573 1.008 2.03.641.458 1.506.73 2.492.838v-2.72C6.84 7.851 4.99 6.933 4.99 5c0-1.894 1.6-2.812 3.25-3.249V1.07a.75.75 0 0 1 1.5 0v.679C10.827 1.924 11.4 2.148 11.9 2.45a.75.75 0 0 1-.8 1.272A5.963 5.963 0 0 0 9.74 3.25v2.484c1.6.437 3.25 1.355 3.25 3.249v.07c0 1.894-1.6 2.812-3.25 3.249v2.484c.548-.131 1.019-.345 1.36-.567.641-.458 1.14-1.161 1.14-2.219v-.07a.75.75 0 0 1 1.5 0v.07c0 1.612-.758 2.812-1.887 3.592-.514.36-1.098.617-1.713.75v.681a.75.75 0 0 1-1.5 0v-.618a5.96 5.96 0 0 1-1.603-.607.75.75 0 0 1 .7-1.33c.43.228.912.388 1.403.516v-2.72C7.59 12.563 4.99 11.645 4.99 10Z" clipRule="evenodd" />
                          </svg>
                          {t("marketplace.detail.transferCommissionAction")}
                        </button>
                      )}

                      {/* Secondary: Share */}
                      <button
                        type="button"
                        onClick={() => void onShareListing()}
                        className="inline-flex h-9 items-center gap-1.5 justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                          <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
                        </svg>
                        {t("marketplace.detail.share")}
                      </button>

                      {/* Spacer pushes delete to end */}
                      <span className="flex-1" aria-hidden="true" />

                      {/* Danger: Delete (icon-only, pushed to end) */}
                      <button
                        type="button"
                        onClick={() => void onDeleteListing()}
                        disabled={isDeleting}
                        title={isDeleting ? t("common.loading") : t("marketplace.detail.deleteAction")}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                      >
                        {isDeleting ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 animate-spin">
                            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                          </svg>
                        )}
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

                <div className="flex flex-wrap items-center gap-3">
                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(availabilityState)}`}>
                    {t(`marketplace.detail.availability.${availabilityState}`)}
                  </div>
                  {/* Price visible on mobile (hidden on lg where sidebar shows it) */}
                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-900 lg:hidden">
                    {listingPriceLabel}
                  </div>
                </div>

                <p className="text-sm text-slate-500">{t("marketplace.postedAt", { value: formatRelativeTime(listing.createdAt, resolvedLanguage) })}</p>

                <section className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{t("marketplace.detail.description")}</h3>
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{descriptionBody ?? t("marketplace.detail.noDescription")}</p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{t("marketplace.detail.specificationsTitle")}</h3>
                  {specificationRows.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      {specificationRows.map((row, index) => (
                        <div
                          key={`${row.label}-${index}`}
                          className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${index < specificationRows.length - 1 ? "border-b border-slate-100" : ""}`}
                        >
                          <span className="font-semibold text-slate-900">{row.label}</span>
                          <span className="text-slate-600">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">{t("marketplace.detail.noSpecifications")}</p>
                  )}
                </section>

                <section className="space-y-2">
                  <p className="text-sm text-slate-700">{listing.locationName ?? t("marketplace.detail.approximateLocation")}</p>
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
      {/* Sticky mobile action bar */}
      {listing ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:hidden">
          {isOwner ? (
            <>
              {shouldShowSaleCompletionAction(listing, salePayment ? [salePayment] : []) && (
                <button
                  type="button"
                  onClick={() => setIsCommissionFlowOpen(true)}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 active:bg-emerald-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path fillRule="evenodd" d="M9.99 1.012a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM4.99 10c0-2.986 2.236-5.498 5.25-5.93V3.07a.75.75 0 0 1 1.5 0v1.04a7.463 7.463 0 0 1 1.603.607.75.75 0 0 1-.7 1.33 5.963 5.963 0 0 0-1.403-.516v2.72c1.65.437 3.25 1.355 3.25 3.249 0 1.894-1.6 2.812-3.25 3.249V15.93a.75.75 0 0 1-1.5 0v-1.181a7.463 7.463 0 0 1-2.205-.83.75.75 0 0 1 .784-1.276c.47.29.996.5 1.421.603V10.82c-1.65-.437-3.25-1.355-3.25-3.25V7.5a.75.75 0 0 1 1.5 0v.07c.348-.044.7-.044 1.047 0a3.86 3.86 0 0 1 .453.081V5.427c-.508.122-.963.315-1.353.578C5.38 6.425 4.99 7.148 4.99 8.07v.07c0 .87.367 1.573 1.008 2.03.641.458 1.506.73 2.492.838v-2.72C6.84 7.851 4.99 6.933 4.99 5c0-1.894 1.6-2.812 3.25-3.249V1.07a.75.75 0 0 1 1.5 0v.679C10.827 1.924 11.4 2.148 11.9 2.45a.75.75 0 0 1-.8 1.272A5.963 5.963 0 0 0 9.74 3.25v2.484c1.6.437 3.25 1.355 3.25 3.249v.07c0 1.894-1.6 2.812-3.25 3.249v2.484c.548-.131 1.019-.345 1.36-.567.641-.458 1.14-1.161 1.14-2.219v-.07a.75.75 0 0 1 1.5 0v.07c0 1.612-.758 2.812-1.887 3.592-.514.36-1.098.617-1.713.75v.681a.75.75 0 0 1-1.5 0v-.618a5.96 5.96 0 0 1-1.603-.607.75.75 0 0 1 .7-1.33c.43.228.912.388 1.403.516v-2.72C7.59 12.563 4.99 11.645 4.99 10Z" clipRule="evenodd" />
                  </svg>
                  {t("marketplace.detail.transferCommissionAction")}
                </button>
              )}
            </>
          ) : (
            <>
              {contactPermissions.canCall ? (
                <a
                  href={`tel:${advertiserPhone}`}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-white active:opacity-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 16.352V17.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z" clipRule="evenodd" />
                  </svg>
                  {t("marketplace.detail.call")}
                </a>
              ) : null}
              {contactPermissions.canChat ? (
                <a
                  href={`https://wa.me/${advertiserPhone.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 active:bg-emerald-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path d="M3.505 2.365A41.369 41.369 0 0 1 9 2c1.863 0 3.697.124 5.495.365 1.247.167 2.318.946 2.85 2.052l.253.53a11.52 11.52 0 0 1 .582 5.98l-.043.304a2.75 2.75 0 0 1-1.526 2.05 .75.75 0 0 0-.428.662v1.576a.75.75 0 0 1-1.06.68l-3.498-1.748a.75.75 0 0 0-.375-.082 10.023 10.023 0 0 1-3.75-.465.75.75 0 0 0-.576.073l-1.998 1.15a.75.75 0 0 1-1.062-.678V12.04a2.75 2.75 0 0 1-1.7-2.23 11.52 11.52 0 0 1 .582-5.98l.253-.529c.532-1.106 1.603-1.885 2.85-2.052Z" />
                  </svg>
                  {t("marketplace.detail.chat")}
                </a>
              ) : null}
              {!contactPermissions.canCall && !contactPermissions.canChat && listing.ownerId ? (
                <Link
                  href={`/${resolvedLanguage}/chat?listingId=${listing.id}&sellerId=${listing.ownerId}`}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-white active:opacity-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 0 0 1.33 0l1.713-3.293a.639.639 0 0 1 .642-.413 44.196 44.196 0 0 0 3.55-.414c1.437-.232 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A44.197 44.197 0 0 0 10 2ZM5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm6-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                  {t("sellerProfile.message")}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border text-sm font-semibold ${
                  isFavorite ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFavorite ? 0 : 1.5} className="h-5 w-5">
                  <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-2.184C4.032 12.18 2.25 9.875 2.25 7a4.5 4.5 0 0 1 8.25-2.5A4.5 4.5 0 0 1 18.75 7c0 2.875-1.783 5.18-3.635 6.936a22.049 22.049 0 0 1-3.744 2.866l-.019.01-.005.003h-.002a.739.739 0 0 1-.69.001l-.002-.001Z" />
                </svg>
              </button>
            </>
          )}
        </div>
      ) : null}

      {listing && snapshot.user?.id && isOwner && (
        <MyAdsSaleCompletion
          isOpen={isCommissionFlowOpen}
          language={resolvedLanguage}
          listing={listing}
          sellerId={snapshot.user.id}
          settings={commissionSettings}
          payment={salePayment}
          onClose={() => setIsCommissionFlowOpen(false)}
          onPaymentUpdated={(updated) => setSalePayment(updated)}
        />
      )}

      {isImagePreviewOpen && listingImages.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
          <button
            type="button"
            onClick={() => setIsImagePreviewOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
          >
            {t("common.close")}
          </button>
          <div
            ref={previewCarouselRef}
            className="flex h-full max-h-[88vh] w-full max-w-5xl snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(event) => updateCarouselIndex(event.currentTarget, setPreviewImageIndex)}
          >
            {listingImages.map((url, index) => (
              <div key={`${listing?.id ?? listingId}-preview-${index}`} className="relative h-full w-full shrink-0 snap-center">
                <Image src={url} alt={listing?.title ?? ""} fill className="object-contain" sizes="100vw" />
              </div>
            ))}
          </div>
          {listingImages.length > 1 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-8 flex items-center justify-center gap-2">
              {listingImages.map((_, index) => (
                <span
                  key={`${listing?.id ?? listingId}-preview-dot-${index}`}
                  className={`rounded-full transition-all ${previewImageIndex === index ? "h-2 w-6 bg-white" : "h-2 w-2 bg-slate-300/70"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </RequireAuth>
  );
}
