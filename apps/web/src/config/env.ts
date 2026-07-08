export function getWebSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error("Missing required web environment variable: NEXT_PUBLIC_SUPABASE_URL. Define it in apps/web/.env.local.");
  }

  if (!supabasePublishableKey || !supabasePublishableKey.trim()) {
    throw new Error("Missing required web environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Define it in apps/web/.env.local.");
  }

  return {
    supabaseUrl,
    supabaseAnonKey: supabasePublishableKey
  };
}
