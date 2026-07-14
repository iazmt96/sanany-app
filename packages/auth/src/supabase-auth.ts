import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import type { AuthPayload, PhoneOtpChannel, PhoneOtpRequestPayload, PhoneOtpVerifyPayload } from "@sanany/types";

export type AuthSubscription = () => void;

export type AuthService = {
  getSession(): Promise<Session | null>;
  signIn(payload: AuthPayload): Promise<void>;
  signUp(payload: AuthPayload): Promise<Session | null>;
  requestPhoneOtp(payload: PhoneOtpRequestPayload): Promise<void>;
  verifyPhoneOtp(payload: PhoneOtpVerifyPayload): Promise<Session | null>;
  requestPasswordReset(email: string, redirectTo?: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (session: Session | null, event: AuthChangeEvent) => void): AuthSubscription;
};

function shouldFallbackToSms(error: unknown, primaryChannel: PhoneOtpChannel, fallbackChannel?: PhoneOtpChannel): boolean {
  if (primaryChannel !== "whatsapp" || fallbackChannel !== "sms") {
    return false;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("whatsapp") ||
    message.includes("twilio") ||
    message.includes("unsupported phone provider") ||
    message.includes("unsupported channel") ||
    message.includes("invalid channel")
  );
}

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw error;
      }

      return data.session;
    },
    async signIn(payload) {
      const { error } = await client.auth.signInWithPassword({
        email: payload.email,
        password: payload.password
      });
      if (error) {
        throw error;
      }
    },
    async signUp(payload) {
      const { data, error } = await client.auth.signUp({
        email: payload.email,
        password: payload.password,
        options:
          payload.accountType || payload.metadata
            ? {
                data: {
                  ...(payload.accountType ? { account_type: payload.accountType } : {}),
                  ...(payload.metadata?.displayName ? { display_name: payload.metadata.displayName, full_name: payload.metadata.displayName } : {}),
                  ...(payload.metadata?.phone ? { phone: payload.metadata.phone } : {}),
                  ...(payload.metadata?.city ? { city: payload.metadata.city } : {}),
                  ...(payload.metadata?.companyName ? { company_name: payload.metadata.companyName } : {}),
                  ...(payload.metadata?.representativeName ? { representative_name: payload.metadata.representativeName } : {}),
                  ...(payload.metadata?.businessType ? { business_type: payload.metadata.businessType } : {}),
                  ...(payload.metadata?.customBusinessType ? { custom_business_type: payload.metadata.customBusinessType } : {}),
                  ...(payload.metadata?.commercialRegistration ? { commercial_registration: payload.metadata.commercialRegistration } : {}),
                  ...(payload.metadata?.taxNumber ? { tax_number: payload.metadata.taxNumber } : {}),
                  ...(payload.metadata?.website ? { website: payload.metadata.website } : {}),
                  ...(payload.metadata?.companyDescription ? { company_description: payload.metadata.companyDescription } : {})
                }
              }
            : undefined
      });
      if (error) {
        throw error;
      }

      return data.session;
    },
    async requestPhoneOtp(payload) {
      const primaryChannel = payload.channel ?? "sms";
      const fallbackChannel = payload.fallbackChannel;

      const requestOtp = async (channel: PhoneOtpChannel) =>
        client.auth.signInWithOtp({
          phone: payload.phone,
          options: {
            channel
          }
        });

      const { error } = await requestOtp(primaryChannel);
      if (!error) {
        return;
      }

      if (fallbackChannel && shouldFallbackToSms(error, primaryChannel, fallbackChannel)) {
        const fallbackResult = await requestOtp(fallbackChannel);
        if (!fallbackResult.error) {
          return;
        }
        throw fallbackResult.error;
      }

      throw error;
    },
    async verifyPhoneOtp(payload) {
      const { data, error } = await client.auth.verifyOtp({
        phone: payload.phone,
        token: payload.token,
        type: "sms"
      });
      if (error) {
        throw error;
      }
      return data.session;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }
    },
    async requestPasswordReset(email, redirectTo) {
      const { error } = await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) {
        throw error;
      }
    },
    onAuthStateChange(listener) {
      const {
        data: { subscription }
      } = client.auth.onAuthStateChange((event, session) => {
        listener(session, event);
      });

      return () => subscription.unsubscribe();
    }
  };
}
