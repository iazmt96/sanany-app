import type { CategoriesRepository } from "@sanany/api";
import { createCategoriesRepository } from "@sanany/api";
import { getMobileSupabaseClient } from "./supabase-client";

let repository: CategoriesRepository | null = null;

export function getMobileCategoriesRepository(): CategoriesRepository {
  if (repository) {
    return repository;
  }

  repository = createCategoriesRepository(getMobileSupabaseClient());
  return repository;
}
