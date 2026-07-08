type RequiredWebEnvKey = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function readRequiredWebEnv(key: RequiredWebEnvKey): string {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing required web environment variable: ${key}. Define it in apps/web/.env.local.`);
  }

  return value;
}

export function getWebSupabaseEnv() {
  return {
    supabaseUrl: readRequiredWebEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readRequiredWebEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  };
}

