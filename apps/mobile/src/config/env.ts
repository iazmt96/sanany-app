import type { PhoneOtpChannel } from "@sanany/types";

function resolvePhoneOtpChannel(value: string | undefined, variableName: string): PhoneOtpChannel {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return "sms";
  }

  if (normalizedValue === "sms" || normalizedValue === "whatsapp") {
    return normalizedValue;
  }

  throw new Error(`Invalid ${variableName}. Use "sms" or "whatsapp".`);
}

export function getMobileSupabaseEnv() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = supabasePublishableKey ?? supabaseAnonKey;
  const phoneOtpChannel = resolvePhoneOtpChannel(
    process.env.EXPO_PUBLIC_SUPABASE_PHONE_OTP_CHANNEL,
    "EXPO_PUBLIC_SUPABASE_PHONE_OTP_CHANNEL"
  );

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
    supabaseAnonKey: supabaseKey,
    phoneOtpChannel
  };
}

export function getMobileGoogleMapsApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing required mobile environment variable: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Define it in apps/mobile/.env.");
  }

  return apiKey;
}
