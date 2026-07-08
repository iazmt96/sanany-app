import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@sanany/api";
import { getWebSupabaseEnv } from "../config/env";

let client: SupabaseClient | null = null;

export function getWebSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  client = createSupabaseClient(getWebSupabaseEnv());
  return client;
}

