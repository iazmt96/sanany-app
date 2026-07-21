"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing, SellerProfile } from "@sanany/types";
import { FAVORITES_STORAGE_KEY, formatRelativeTime, getPrimaryListingImageUrl, hasStoredId, toggleStoredId } from "@sanany/shared";
import { Badge, Card } from "@sanany/ui";
import { resolveListingPriceLabel } from "../lib/listing-price-label";

type ListingCardProps = {
  listing: MarketplaceListing;
  language: string;
  sellerProfile?: Pick<SellerProfile, "displayName" | "isVerified" | "ratingAverage" | "ratingCount"> | null;
  insightLabel?: string | null;
};

function formatSellerRating(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0";
  }

  return value.toFixed(1);
}

export function ListingCard({ listing, language, sellerProfile = null, insightLabel = null }: ListingCardProps) {
  const { t } = useTranslation();
  const primaryImage = getPrimaryListingImageUrl(listing.imageUrl);
  const [isFavorite, setIsFavorite] = useState(false);
  const listingHref = `/${language}/listing/${listing.id}`;
  const locationLabel = listing.locationName ?? t("marketplace.detail.approximateLocation");
  const postedAtLabel = t("marketplace.postedAt", { value: formatRelativeTime(listing.createdAt, language) });
  const priceLabel = useMemo(() => resolveListingPriceLabel(listing, t), [listing, t]);
  const trustLabel = useMemo(() => {
    if (!sellerProfile) {
      return null;
    }

    if (sellerProfile.isVerified) {
      return sellerProfile.ratingCount > 0
        ? `${t("home.verifiedBadge")} · ${formatSellerRating(sellerProfile.ratingAverage)}`
        : t("home.verifiedBadge");
    }

    if (sellerProfile.ratingCount > 0) {
      return `${formatSellerRating(sellerProfile.ratingAverage)} · ${t("home.card.ratings", { count: sellerProfile.ratingCount })}`;
    }

    return null;
  }, [sellerProfile, t]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      setIsFavorite(hasStoredId(raw, listing.id));
    } catch {
      setIsFavorite(false);
    }
  }, [listing.id]);

  const toggleFavorite = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const next = toggleStoredId(raw, listing.id);
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, next.serialized);
      setIsFavorite(next.isSelected);
    } catch {
      setIsFavorite((current) => !current);
    }
  };

  return (
    <Card className="group overflow-hidden border-slate-200 bg-white p-0 transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg">
      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
        <Link href={listingHref} className="absolute inset-0 z-10" aria-label={listing.title} />
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={listing.title}
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 16vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-slate-100 to-cyan-50" />
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {insightLabel ? (
              <span className="inline-flex rounded-full bg-slate-950/72 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                {insightLabel}
              </span>
            ) : null}
            {listing.status !== "available" ? <Badge variant={listing.status}>{t(`marketplace.status.${listing.status}`)}</Badge> : null}
          </div>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={isFavorite ? t("marketplace.favorite.remove") : t("marketplace.favorite.add")}
            title={isFavorite ? t("marketplace.favorite.remove") : t("marketplace.favorite.add")}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-sm transition ${
              isFavorite
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-white/70 bg-white/92 text-slate-600 hover:text-rose-600"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21s-7-4.6-9.2-9C1 8.4 3.3 5 6.9 5c2 0 3.2 1 4.1 2.3C11.9 6 13.1 5 15.1 5 18.7 5 21 8.4 20.2 12c-2.2 4.4-8.2 9-8.2 9z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-extrabold tracking-tight text-slate-900">{priceLabel}</p>
              {listing.status === "sold" ? (
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {t("marketplace.status.sold")}
                </span>
              ) : null}
            </div>
            <h2 className="line-clamp-2 text-base font-semibold text-slate-900">
              <Link href={listingHref} className="hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
                {listing.title}
              </Link>
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" fill="currentColor">
              <path d="M10 2.5a5.5 5.5 0 0 1 5.5 5.5c0 3.3-3.12 7.1-4.7 8.85a1 1 0 0 1-1.6 0C7.62 15.1 4.5 11.3 4.5 8A5.5 5.5 0 0 1 10 2.5Zm0 7.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z" />
            </svg>
            <span className="truncate">{locationLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" fill="currentColor">
              <path d="M10 3.25a.75.75 0 0 1 .75.75v5.19l3.03 1.75a.75.75 0 1 1-.75 1.3l-3.4-1.96A.75.75 0 0 1 9.25 9.6V4a.75.75 0 0 1 .75-.75Z" />
              <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-1.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z" />
            </svg>
            <span>{postedAtLabel}</span>
          </span>
        </div>

        {sellerProfile ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{sellerProfile.displayName}</p>
              <p className="truncate text-xs text-slate-500">{trustLabel ?? t("home.card.sellerReady")}</p>
            </div>
            {sellerProfile.isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                  <path d="M10 1.75a1 1 0 0 1 .64.23l1.66 1.39 2.12.18a1 1 0 0 1 .84.6l.82 1.97 1.72 1.27a1 1 0 0 1 .37 1.02l-.56 2.05.56 2.05a1 1 0 0 1-.37 1.02l-1.72 1.27-.82 1.97a1 1 0 0 1-.84.6l-2.12.18-1.66 1.39a1 1 0 0 1-1.28 0l-1.66-1.39-2.12-.18a1 1 0 0 1-.84-.6l-.82-1.97-1.72-1.27a1 1 0 0 1-.37-1.02l.56-2.05-.56-2.05a1 1 0 0 1 .37-1.02l1.72-1.27.82-1.97a1 1 0 0 1 .84-.6l2.12-.18 1.66-1.39A1 1 0 0 1 10 1.75Zm2.78 6.74a.75.75 0 0 0-1.06-1.06l-2.47 2.47-.97-.97a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3-3Z" />
                </svg>
                {t("home.verifiedBadge")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
