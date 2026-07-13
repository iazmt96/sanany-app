export const FAVORITES_STORAGE_KEY = "sanany:favorites";
export const REPORTED_LISTINGS_STORAGE_KEY = "sanany:reported-listings";
export const LISTING_VIEWS_STORAGE_KEY = "sanany:listing-views";

export function parseStoredIdList(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  } catch {
    return [];
  }
}

export function hasStoredId(raw: string | null | undefined, id: string): boolean {
  return parseStoredIdList(raw).includes(id);
}

export function toggleStoredId(raw: string | null | undefined, id: string): { ids: string[]; isSelected: boolean; serialized: string } {
  const ids = parseStoredIdList(raw);
  const nextIds = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  return {
    ids: nextIds,
    isSelected: nextIds.includes(id),
    serialized: JSON.stringify(nextIds)
  };
}

export function removeStoredId(raw: string | null | undefined, id: string): { ids: string[]; serialized: string } {
  const ids = parseStoredIdList(raw).filter((item) => item !== id);
  return {
    ids,
    serialized: JSON.stringify(ids)
  };
}
