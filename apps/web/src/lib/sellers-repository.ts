import type { SellersRepository } from "@sanany/api";
import { createSellersRepository } from "@sanany/api";
import { getWebSupabaseClient } from "./supabase-client";

let repository: SellersRepository | null = null;

export function getWebSellersRepository(): SellersRepository {
  if (repository) {
    return repository;
  }

  repository = createSellersRepository(getWebSupabaseClient());
  return repository;
}

