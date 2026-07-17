import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function resolveSupabasePublicKey(): string {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (publishableKey) {
    return publishableKey;
  }
  if (anonKey) {
    return anonKey;
  }
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
}

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = resolveSupabasePublicKey();

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components may invoke this path while rendering.
        }
      }
    }
  });
}
