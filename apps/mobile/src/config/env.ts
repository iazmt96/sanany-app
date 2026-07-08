export function getMobileSupabaseEnv() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = supabasePublishableKey ?? supabaseAnonKey;

  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error("Missing required mobile environment variable: EXPO_PUBLIC_SUPABASE_URL. Define it in apps/mobile/.env.");
  }

  if (!supabaseKey || !supabaseKey.trim()) {
    throw new Error(
      "Missing required mobile environment variable: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY). Define it in apps/mobile/.env."
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey: supabaseKey
  };
}
