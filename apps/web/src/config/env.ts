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
