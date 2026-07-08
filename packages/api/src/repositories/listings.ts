import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";

export type ListingsRepository = {
  list(query: ListingsQuery): Promise<PaginatedResult<MarketplaceListing>>;
};

type ListingRow = {
  id: string;
  title_key: string;
  summary_key: string;
  location_key: string;
  status: MarketplaceListing["status"];
  daily_price: number;
};

const DEFAULT_PAGE_SIZE = 9;

function normalizeQuery(query: ListingsQuery): ListingsQuery {
  const page = Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
  const pageSize = Number.isInteger(query.pageSize) && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE;

  return {
    search: query.search.trim(),
    status: query.status,
    page,
    pageSize
  };
}

function mapRow(row: ListingRow): MarketplaceListing {
  return {
    id: row.id,
    titleKey: row.title_key,
    summaryKey: row.summary_key,
    locationKey: row.location_key,
    status: row.status,
    dailyPrice: row.daily_price
  };
}

export function createListingsRepository(client: SupabaseClient): ListingsRepository {
  return {
    async list(query) {
      const normalizedQuery = normalizeQuery(query);
      const from = (normalizedQuery.page - 1) * normalizedQuery.pageSize;
      const to = from + normalizedQuery.pageSize - 1;

      let supabaseQuery = client
        .from("listings")
        .select("id,title_key,summary_key,location_key,status,daily_price", { count: "exact" })
        .order("id", { ascending: true })
        .range(from, to);

      if (normalizedQuery.status !== "all") {
        supabaseQuery = supabaseQuery.eq("status", normalizedQuery.status);
      }

      if (normalizedQuery.search) {
        const escapedSearch = normalizedQuery.search.replaceAll("%", "\\%").replaceAll("_", "\\_");
        supabaseQuery = supabaseQuery.or(
          `title_key.ilike.%${escapedSearch}%,summary_key.ilike.%${escapedSearch}%,location_key.ilike.%${escapedSearch}%`
        );
      }

      const { data, error, count } = await supabaseQuery;

      if (error) {
        throw error;
      }

      const totalItems = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalItems / normalizedQuery.pageSize));

      return {
        items: (data ?? []).map((row) => mapRow(row as ListingRow)),
        totalItems,
        page: normalizedQuery.page,
        pageSize: normalizedQuery.pageSize,
        totalPages
      };
    }
  };
}
