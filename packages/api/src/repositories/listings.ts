import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateListingInput, ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";

export type ListingsRepository = {
  list(query: ListingsQuery): Promise<PaginatedResult<MarketplaceListing>>;
  create(input: CreateListingInput): Promise<MarketplaceListing>;
  getById(id: string): Promise<MarketplaceListing | null>;
};

type ListingRow = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: MarketplaceListing["status"];
  image_url: string | null;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 9;

function normalizeQuery(query: ListingsQuery): ListingsQuery {
  const page = Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
  const pageSize = Number.isInteger(query.pageSize) && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE;
  const sort: ListingsQuery["sort"] =
    query.sort === "priceHigh" || query.sort === "priceLow" || query.sort === "newest" ? query.sort : "newest";

  return {
    search: query.search.trim(),
    status: query.status,
    sort,
    page,
    pageSize
  };
}

function mapRow(row: ListingRow): MarketplaceListing {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    status: row.status,
    imageUrl: row.image_url,
    createdAt: row.created_at
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
        .select("id,title,description,price,status,image_url,created_at", { count: "exact" })
        .range(from, to);

      if (normalizedQuery.sort === "priceHigh") {
        supabaseQuery = supabaseQuery.order("price", { ascending: false }).order("created_at", { ascending: false });
      } else if (normalizedQuery.sort === "priceLow") {
        supabaseQuery = supabaseQuery.order("price", { ascending: true }).order("created_at", { ascending: false });
      } else {
        supabaseQuery = supabaseQuery.order("created_at", { ascending: false });
      }

      if (normalizedQuery.status !== "all") {
        supabaseQuery = supabaseQuery.eq("status", normalizedQuery.status);
      }

      if (normalizedQuery.search) {
        const escapedSearch = normalizedQuery.search.replaceAll("%", "\\%").replaceAll("_", "\\_");
        supabaseQuery = supabaseQuery.or(
          `title.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`
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
    },
    async create(input) {
      const { data, error } = await client
        .from("listings")
        .insert({
          title: input.title.trim(),
          description: input.description.trim() || null,
          price: input.price,
          status: input.status ?? "available",
          owner_id: input.ownerId
        })
        .select("id,title,description,price,status,image_url,created_at")
        .single();

      if (error) {
        throw error;
      }

      return mapRow(data as ListingRow);
    },
    async getById(id) {
      const { data, error } = await client
        .from("listings")
        .select("id,title,description,price,status,image_url,created_at")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return mapRow(data as ListingRow);
    }
  };
}
