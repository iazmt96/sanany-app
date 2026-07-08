import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import type { AuthPayload } from "@sanany/types";

export type AuthSubscription = () => void;

export type AuthService = {
  getSession(): Promise<Session | null>;
  signIn(payload: AuthPayload): Promise<void>;
  signUp(payload: AuthPayload): Promise<Session | null>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (session: Session | null, event: AuthChangeEvent) => void): AuthSubscription;
};

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
      const { error } = await client.auth.signInWithPassword(payload);
      if (error) {
        throw error;
      }
    },
    async signUp(payload) {
      const { data, error } = await client.auth.signUp(payload);
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
