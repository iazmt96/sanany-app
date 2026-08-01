import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupabaseClient, SupportedStorage } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { createSupabaseClient } from "@sanany/api";
import { getMobileSupabaseEnv } from "../config/env";

let client: SupabaseClient | null = null;

function getSupabaseStorage(): SupportedStorage | undefined {
  if (Platform.OS !== "web") {
    return AsyncStorage;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return undefined;
  }

  return {
    getItem: async (key: string) => window.localStorage.getItem(key),
    setItem: async (key: string, value: string) => {
      window.localStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
      window.localStorage.removeItem(key);
    }
  };
}

export function getMobileSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  client = createSupabaseClient(getMobileSupabaseEnv(), {
    storage: getSupabaseStorage(),
    detectSessionInUrl: false,
    storageKey: "sanany-mobile-auth",
    realtimeDisabled: true,
  });

  // Immediately disconnect Realtime — mobile app does not use live channels.
  // This prevents ws/EventTarget prototype errors on React Native / Hermes.
  try {
    client.realtime.disconnect();
  } catch {
    // ignore — non-critical
  }

  return client;
}
