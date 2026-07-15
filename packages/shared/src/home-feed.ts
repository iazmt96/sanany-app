export const RECENT_SEARCHES_STORAGE_KEY = "sanany:recent-searches";
export const SAVED_SEARCHES_STORAGE_KEY = "sanany:saved-searches";
export const HOME_MAX_STORED_SEARCHES = 6;

export type StoredSearch = {
  id: string;
  query: string;
  city: string | null;
  categorySlug: string | null;
  createdAt: string;
};

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function buildStoredSearchId(input: { query: string; city?: string | null; categorySlug?: string | null }): string {
  const query = input.query.trim().toLowerCase();
  const city = (input.city ?? "").trim().toLowerCase();
  const categorySlug = (input.categorySlug ?? "").trim().toLowerCase();
  return [query, city, categorySlug].join("::");
}

export function parseStoredSearches(raw: string | null | undefined): StoredSearch[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const payload = item as Record<string, unknown>;
        const query = normalizeNullableText(payload.query);
        if (!query) {
          return null;
        }

        const city = normalizeNullableText(payload.city);
        const categorySlug = normalizeNullableText(payload.categorySlug);
        const createdAt = normalizeNullableText(payload.createdAt) ?? new Date(0).toISOString();

        return {
          id: buildStoredSearchId({ query, city, categorySlug }),
          query,
          city,
          categorySlug,
          createdAt
        } satisfies StoredSearch;
      })
      .filter((item): item is StoredSearch => Boolean(item))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  } catch {
    return [];
  }
}

export function upsertStoredSearch(
  raw: string | null | undefined,
  input: { query: string; city?: string | null; categorySlug?: string | null },
  limit = HOME_MAX_STORED_SEARCHES
): { items: StoredSearch[]; serialized: string } {
  const query = input.query.trim();
  if (query.length === 0) {
    const items = parseStoredSearches(raw);
    return {
      items,
      serialized: JSON.stringify(items)
    };
  }

  const city = normalizeNullableText(input.city);
  const categorySlug = normalizeNullableText(input.categorySlug);
  const id = buildStoredSearchId({ query, city, categorySlug });
  const nextItem: StoredSearch = {
    id,
    query,
    city,
    categorySlug,
    createdAt: new Date().toISOString()
  };

  const items = [nextItem, ...parseStoredSearches(raw).filter((item) => item.id !== id)].slice(0, Math.max(1, limit));
  return {
    items,
    serialized: JSON.stringify(items)
  };
}

export function removeStoredSearch(raw: string | null | undefined, id: string): { items: StoredSearch[]; serialized: string } {
  const items = parseStoredSearches(raw).filter((item) => item.id !== id);
  return {
    items,
    serialized: JSON.stringify(items)
  };
}
