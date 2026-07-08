import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@sanany/api";
import { getMobileSupabaseEnv } from "../config/env";

let client: SupabaseClient | null = null;

export function getMobileSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  client = createSupabaseClient(getMobileSupabaseEnv(), {
    storage: AsyncStorage,
    detectSessionInUrl: false
  });

  return client;
}

