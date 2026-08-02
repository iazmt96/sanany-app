import type { ListingStatus, MarketplaceListing } from "@sanany/types";
import { isListingActiveForSaleCompletion } from "./commission.ts";

export const LISTING_MANAGEMENT_SECTIONS = ["active", "drafts", "pending", "sold", "rejected", "expired"] as const;
export type ListingManagementSection = (typeof LISTING_MANAGEMENT_SECTIONS)[number];

export function mapSectionToStatus(section: ListingManagementSection): ListingStatus | null {
  if (section === "active") {
    return null;
  }
  if (section === "drafts") {
    return "draft";
  }
  if (section === "sold") {
    return "sold";
  }
  if (section === "expired") {
    return "inactive";
  }
  return null;
}

export function isSectionBackedByMobileStatus(section: ListingManagementSection): boolean {
  return section === "active" || section === "drafts" || section === "sold" || section === "expired";
}

export function matchesListingManagementSection(listing: MarketplaceListing, section: ListingManagementSection): boolean {
  if (section === "active") {
    return isListingActiveForSaleCompletion(listing.status);
  }
  if (section === "drafts") {
    return listing.status === "draft";
  }
  if (section === "sold") {
    return listing.status === "sold";
  }
  if (section === "expired") {
    return listing.status === "inactive";
  }
  return false;
}

export function computeListingQualityScore(input: {
  title: string;
  description: string;
  imageCount: number;
  hasCategory: boolean;
  hasOfferType: boolean;
  hasPrice: boolean;
  hasCarLocation: boolean;
  isCarSaleCategory: boolean;
}): number {
  let score = 0;
  if (input.title.trim().length >= 8) {
    score += 20;
  }
  if (input.description.trim().length >= 24) {
    score += 20;
  }
  if (input.imageCount >= 1) {
    score += 20;
  }
  if (input.imageCount >= 5) {
    score += 10;
  }
  if (input.hasCategory) {
    score += 10;
  }
  if (input.hasOfferType) {
    score += 10;
  }
  if (input.hasPrice) {
    score += 10;
  }
  if (!input.isCarSaleCategory || input.hasCarLocation) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}
