import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function createSupabaseClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
}

