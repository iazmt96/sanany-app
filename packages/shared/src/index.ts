import type { MarketplaceListing } from "@sanany/types";
import { ar } from "./translations/ar";
import { en } from "./translations/en";

export const resources = {
  ar: { translation: ar },
  en: { translation: en }
} as const;

export const marketplaceSeedListings: MarketplaceListing[] = [
  {
    id: "listing-one",
    titleKey: "marketplace.listings.listingOneTitle",
    summaryKey: "marketplace.listings.listingOneSummary",
    locationKey: "marketplace.listings.listingOneLocation",
    status: "available",
    dailyPrice: 600
  },
  {
    id: "listing-two",
    titleKey: "marketplace.listings.listingTwoTitle",
    summaryKey: "marketplace.listings.listingTwoSummary",
    locationKey: "marketplace.listings.listingTwoLocation",
    status: "reserved",
    dailyPrice: 850
  },
  {
    id: "listing-three",
    titleKey: "marketplace.listings.listingThreeTitle",
    summaryKey: "marketplace.listings.listingThreeSummary",
    locationKey: "marketplace.listings.listingThreeLocation",
    status: "available",
    dailyPrice: 1200
  }
];

