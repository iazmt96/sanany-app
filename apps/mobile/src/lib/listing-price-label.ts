import { CAR_PRICE_MODES, type CarPriceMode, type MarketplaceListing } from "@sanany/types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function resolvePriceModeFromAttributes(listing: MarketplaceListing): CarPriceMode | null {
  const value = listing.attributes?.priceMode;
  if (typeof value === "string" && CAR_PRICE_MODES.includes(value as CarPriceMode)) {
    return value as CarPriceMode;
  }
  return null;
}

function resolvePriceModeFromDescription(description: string | null): CarPriceMode | null {
  if (!description || description.trim().length === 0) {
    return null;
  }

  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (!line.startsWith("- ")) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const label = normalizeToken(line.slice(2, separatorIndex));
    if (!label.includes("تسعير الإعلان") && !label.includes("price mode")) {
      continue;
    }

    const value = normalizeToken(line.slice(separatorIndex + 1));
    if (value.includes("سعر محدد") || value.includes("fixed")) {
      return "fixed";
    }
    if (value.includes("على السوم") || value.includes("on bid") || value.includes("bid")) {
      return "bid";
    }
    if (value.includes("حسب العمل") || value.includes("by work")) {
      return "byWork";
    }
  }

  return null;
}

export function resolveListingPriceMode(listing: MarketplaceListing): CarPriceMode | null {
  const fromAttributes = resolvePriceModeFromAttributes(listing);
  if (fromAttributes) {
    return fromAttributes;
  }
  return resolvePriceModeFromDescription(listing.description);
}

export function resolveListingPriceLabel(listing: MarketplaceListing, t: Translate): string {
  const priceMode = resolveListingPriceMode(listing);
  if (priceMode && priceMode !== "fixed") {
    return t(`marketplace.create.carDetails.priceModeOptions.${priceMode}`);
  }
  return t("marketplace.pricePerDay", { value: listing.price });
}
