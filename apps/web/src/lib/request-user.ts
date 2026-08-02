import { createClient as createSupabaseAdminClient, createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createCookieSupabaseClient } from "../../utils/supabase/server";

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

function resolveSupabasePublishableKey(): string {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (publishableKey?.trim()) {
    return publishableKey.trim();
  }
  if (anonKey?.trim()) {
    return anonKey.trim();
  }
  throw new Error("Missing Supabase public server configuration. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

export async function createRequestSupabaseClient(request: Request): Promise<SupabaseClient> {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return createCookieSupabaseClient();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl?.trim()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  return createSupabaseClient(supabaseUrl.trim(), resolveSupabasePublishableKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

export async function resolveRequestUser(request: Request): Promise<{ user: User | null; error: string | null }> {
  const cookieClient = await createCookieSupabaseClient();
  const {
    data: { user: cookieUser },
    error: cookieError
  } = await cookieClient.auth.getUser();

  if (cookieUser) {
    return { user: cookieUser, error: null };
  }

  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return { user: null, error: cookieError?.message ?? "Unauthorized." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      user: null,
      error: "Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    };
  }

  const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const {
    data: { user },
    error
  } = await adminClient.auth.getUser(accessToken);

  return {
    user: user ?? null,
    error: error?.message ?? (user ? null : "Unauthorized.")
  };
}
