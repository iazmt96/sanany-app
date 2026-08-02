import type { ListingsRepository } from "@sanany/api";
import { createListingsRepository } from "@sanany/api";
import { getWebSupabaseClient } from "./supabase-client";

let repository: ListingsRepository | null = null;

export function getWebListingsRepository(): ListingsRepository {
  if (repository) {
    return repository;
  }

  repository = createListingsRepository(getWebSupabaseClient());
  return repository;
}

