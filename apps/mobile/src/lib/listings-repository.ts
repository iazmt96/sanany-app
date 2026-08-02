import type { ListingsRepository } from "@sanany/api";
import { createListingsRepository } from "@sanany/api";
import { getMobileSupabaseClient } from "./supabase-client";

let repository: ListingsRepository | null = null;

export function getMobileListingsRepository(): ListingsRepository {
  if (repository) {
    return repository;
  }

  repository = createListingsRepository(getMobileSupabaseClient());
  return repository;
}

