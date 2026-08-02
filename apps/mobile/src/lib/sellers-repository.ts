import type { SellersRepository } from "@sanany/api";
import { createSellersRepository } from "@sanany/api";
import { getMobileSupabaseClient } from "./supabase-client";

let repository: SellersRepository | null = null;

export function getMobileSellersRepository(): SellersRepository {
  if (repository) {
    return repository;
  }

  repository = createSellersRepository(getMobileSupabaseClient());
  return repository;
}

