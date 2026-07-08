import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { getWebSupabaseEnv } from "../config/env";

let client: SupabaseClient | null = null;

export function getWebSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const env = getWebSupabaseEnv();
  client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
