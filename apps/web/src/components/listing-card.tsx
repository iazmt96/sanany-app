"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import { FAVORITES_STORAGE_KEY, formatRelativeTime, getPrimaryListingImageUrl, hasStoredId, toggleStoredId } from "@sanany/shared";
import { Badge, Card } from "@sanany/ui";

type ListingCardProps = {
  listing: MarketplaceListing;
  language: string;
};

export function ListingCard({ listing, language }: ListingCardProps) {
  const { t } = useTranslation();
  const primaryImage = getPrimaryListingImageUrl(listing.imageUrl);
  const [isFavorite, setIsFavorite] = useState(false);
  const listingHref = `/${language}/listing/${listing.id}`;

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
    <Card className="space-y-3 transition hover:border-brand hover:shadow-md">
      <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100">
        <Link href={listingHref} className="absolute inset-0 z-10" aria-label={listing.title} />
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={listing.title}
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 16vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50" />
        )}
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={isFavorite ? t("marketplace.favorite.remove") : t("marketplace.favorite.add")}
          title={isFavorite ? t("marketplace.favorite.remove") : t("marketplace.favorite.add")}
          className={`absolute right-2 top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm transition ${
            isFavorite
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-slate-200 bg-white/95 text-slate-600 hover:text-rose-600"
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
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">
          <Link href={listingHref} className="hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
            {listing.title}
          </Link>
        </h2>
        <Badge variant={listing.status}>{t(`marketplace.status.${listing.status}`)}</Badge>
      </div>
      {listing.description ? <p className="line-clamp-2 text-sm text-slate-600">{listing.description}</p> : null}
      <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
        <span>{t("marketplace.postedAt", { value: formatRelativeTime(listing.createdAt, language) })}</span>
        <span>{t("marketplace.pricePerDay", { value: listing.price })}</span>
      </div>
    </Card>
  );
}
