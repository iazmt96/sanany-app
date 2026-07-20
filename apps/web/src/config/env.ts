import type { PhoneOtpChannel } from "@sanany/types";

function resolvePhoneOtpChannel(value: string | undefined, variableName: string): PhoneOtpChannel {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return "sms";
  }

  if (normalizedValue === "sms" || normalizedValue === "whatsapp") {
    return normalizedValue;
  }

  // Log the invalid value for debugging in production
  console.warn(
    `Warning: Invalid ${variableName}="${value}" (normalized: "${normalizedValue}"). ` +
    `Valid values are "sms" or "whatsapp". Defaulting to "sms".`
  );
  
  // Default to "sms" instead of throwing to prevent production 500 errors
  return "sms";
}

export function getWebSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const phoneOtpChannel = resolvePhoneOtpChannel(
    process.env.NEXT_PUBLIC_SUPABASE_PHONE_OTP_CHANNEL,
    "NEXT_PUBLIC_SUPABASE_PHONE_OTP_CHANNEL"
  );

  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error("Missing required web environment variable: NEXT_PUBLIC_SUPABASE_URL. Define it in apps/web/.env.local.");
  }

  if (!supabasePublishableKey || !supabasePublishableKey.trim()) {
    throw new Error(
      "Missing required web environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY). Define it in apps/web/.env.local."
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey: supabasePublishableKey,
    phoneOtpChannel
  };
}

export function getWebGoogleMapsApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "Missing required web environment variable: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Define it in apps/web/.env.local."
    );
  }

  return apiKey;
}
