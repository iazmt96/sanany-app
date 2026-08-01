import { type MessagingRepository, createMessagingRepository } from "@sanany/api";
import { getMobileSupabaseClient } from "./supabase-client";

let repository: MessagingRepository | null = null;

export function getMobileMessagingRepository(): MessagingRepository {
  if (repository) {
    return repository;
  }

  repository = createMessagingRepository(getMobileSupabaseClient());
  return repository;
}
