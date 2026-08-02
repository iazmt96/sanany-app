import type { ListingsQuery } from "@sanany/types";
import { normalizeListingsFilters } from "./search-filters.ts";

export const DEFAULT_LISTINGS_PAGE_SIZE = 9;

export function normalizeListingsQuery(input: ListingsQuery, defaultPageSize = DEFAULT_LISTINGS_PAGE_SIZE): ListingsQuery {
  const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  const pageSize = Number.isInteger(input.pageSize) && input.pageSize > 0 ? input.pageSize : defaultPageSize;
  const sort: ListingsQuery["sort"] = input.sort === "priceHigh" || input.sort === "priceLow" || input.sort === "newest" ? input.sort : "newest";

  return {
    search: input.search.trim(),
    status: input.status,
    sort,
    page,
    pageSize,
    filters: normalizeListingsFilters(input.filters)
  };
}

export function escapeListingsSearchTerm(search: string): string {
  return search.replaceAll("%", "\\%").replaceAll("_", "\\_");
}
