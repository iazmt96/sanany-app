import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { getWebSupabaseEnv } from "../config/env";

let client: SupabaseClient | null = null;

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days — matches refresh token lifetime

export function getWebSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const env = getWebSupabaseEnv();
  client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: {
      maxAge: AUTH_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  });
  return client;
}
