import type { CategoriesRepository } from "@sanany/api";
import { createCategoriesRepository } from "@sanany/api";
import { getWebSupabaseClient } from "./supabase-client";

let repository: CategoriesRepository | null = null;

export function getWebCategoriesRepository(): CategoriesRepository {
  if (repository) {
    return repository;
  }

  repository = createCategoriesRepository(getWebSupabaseClient());
  return repository;
}
