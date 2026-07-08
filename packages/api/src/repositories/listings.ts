import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketplaceListing } from "@sanany/types";

export type ListingsRepository = {
  listActive(): Promise<MarketplaceListing[]>;
};

export function createListingsRepository(client: SupabaseClient): ListingsRepository {
  return {
    async listActive() {
      const { data, error } = await client.from("listings").select("id,title_key,summary_key,location_key,status,daily_price");

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        titleKey: row.title_key,
        summaryKey: row.summary_key,
        locationKey: row.location_key,
        status: row.status,
        dailyPrice: row.daily_price
      }));
    }
  };
}

