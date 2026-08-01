import { createClient, type SupportedStorage, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type SupabaseClientFactoryOptions = {
  storage?: SupportedStorage;
  detectSessionInUrl?: boolean;
  storageKey?: string;
  realtimeDisabled?: boolean;
};

function assertValue(name: string, value: string): string {
  if (!value.trim()) {
    throw new Error(`Missing required Supabase configuration: ${name}`);
  }

  return value;
}

export function createSupabaseClient(env: SupabaseEnv, options: SupabaseClientFactoryOptions = {}): SupabaseClient {
  const supabaseUrl = assertValue("supabaseUrl", env.supabaseUrl);
  const supabaseAnonKey = assertValue("supabaseAnonKey", env.supabaseAnonKey);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: options.storage,
      detectSessionInUrl: options.detectSessionInUrl ?? true,
      storageKey: options.storageKey
    },
    realtime: options.realtimeDisabled
      ? {
          // Completely disable realtime channels for React Native
          // (avoids ws/EventTarget prototype errors in Hermes)
          params: { eventsPerSecond: -1 },
          timeout: 0,
        }
      : undefined,
    global: options.realtimeDisabled
      ? { headers: {} }
      : undefined,
  });
}
