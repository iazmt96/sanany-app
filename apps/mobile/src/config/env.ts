type RequiredMobileEnvKey = "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY";

function readRequiredMobileEnv(key: RequiredMobileEnvKey): string {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing required mobile environment variable: ${key}. Define it in apps/mobile/.env.`);
  }

  return value;
}

export function getMobileSupabaseEnv() {
  return {
    supabaseUrl: readRequiredMobileEnv("EXPO_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readRequiredMobileEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
  };
}

