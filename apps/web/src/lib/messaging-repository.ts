import type { MessagingRepository } from "@sanany/api";
import { createMessagingRepository } from "@sanany/api";
import { getWebSupabaseClient } from "./supabase-client";

let repository: MessagingRepository | null = null;

export function getWebMessagingRepository(): MessagingRepository {
  if (repository) {
    return repository;
  }

  repository = createMessagingRepository(getWebSupabaseClient());
  return repository;
}
