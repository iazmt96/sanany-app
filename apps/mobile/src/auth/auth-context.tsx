import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { AuthController, AuthSnapshot } from "@sanany/auth";
import { createAccountRepository } from "@sanany/api";
import type {
  AccountProfile,
  AuthPayload,
  BasicAccountProfileInput,
  PhoneOtpRequestPayload,
  PhoneOtpVerifyPayload,
  UpdateAccountProfileInput,
  UsernameAvailability
} from "@sanany/types";
import { isBasicAccountProfileComplete } from "@sanany/shared";
import { getMobileAuthController } from "../lib/auth-controller";
import { getMobileSupabaseClient } from "../lib/supabase-client";
import { getMobileSupabaseEnv } from "../config/env";

export type ProfileStatus = "loading" | "anonymous" | "required" | "complete" | "error";

type AuthContextValue = {
  snapshot: AuthSnapshot;
  accountProfile: AccountProfile | null;
  profileStatus: ProfileStatus;
  profileError: string | null;
  signIn(payload: AuthPayload): Promise<void>;
  signUp(payload: AuthPayload): Promise<AuthSnapshot["session"]>;
  requestPhoneOtp(payload: PhoneOtpRequestPayload): Promise<void>;
  verifyPhoneOtp(payload: PhoneOtpVerifyPayload): Promise<AuthSnapshot["session"]>;
  completeBasicProfile(input: BasicAccountProfileInput): Promise<void>;
  updateOptionalProfile(input: UpdateAccountProfileInput): Promise<void>;
  checkUsernameAvailability(username: string, displayName?: string): Promise<UsernameAvailability>;
  refreshAccountProfile(): Promise<void>;
  requestPasswordReset(email: string, redirectTo?: string): Promise<void>;
  signOut(): Promise<void>;
};

const initialSnapshot: AuthSnapshot = {
  status: "loading",
  session: null,
  user: null
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren;

export function AuthProvider({ children }: AuthProviderProps) {
  const env = useMemo(() => getMobileSupabaseEnv(), []);
  const controller: AuthController = useMemo(() => getMobileAuthController(), []);
  const client = useMemo(() => getMobileSupabaseClient(), []);
  const repository = useMemo(() => createAccountRepository(client), [client]);
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(initialSnapshot);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshAccountProfile = useCallback(async () => {
    const userId = controller.getSnapshot().user?.id;
    if (!userId) {
      setAccountProfile(null);
      setProfileStatus("anonymous");
      setProfileError(null);
      return;
    }

    setProfileStatus("loading");
    setProfileError(null);
    try {
      const profile = await repository.getAccountProfile(userId);
      setAccountProfile(profile);
      setProfileStatus(isBasicAccountProfileComplete(profile) ? "complete" : "required");
    } catch (error) {
      setAccountProfile(null);
      setProfileStatus("error");
      setProfileError(error instanceof Error ? error.message : "Failed to load account profile.");
    }
  }, [controller, repository]);

  useEffect(() => {
    const unsubscribe = controller.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      if (nextSnapshot.user?.id) {
        void refreshAccountProfile();
      } else {
        setAccountProfile(null);
        setProfileStatus("anonymous");
        setProfileError(null);
      }
    });

    void controller.initialize().then((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      if (nextSnapshot.user?.id) {
        void refreshAccountProfile();
      } else {
        setProfileStatus("anonymous");
      }
    });
    return unsubscribe;
  }, [controller, refreshAccountProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      snapshot,
      accountProfile,
      profileStatus,
      profileError,
      signIn: (payload) => controller.signIn(payload),
      signUp: (payload) => controller.signUp(payload),
      requestPhoneOtp: (payload) =>
        controller.requestPhoneOtp({
          ...payload,
          channel: env.phoneOtpChannel,
          fallbackChannel: env.phoneOtpChannel === "whatsapp" ? "sms" : undefined
        }),
      verifyPhoneOtp: (payload) => controller.verifyPhoneOtp(payload),
      completeBasicProfile: async (input) => {
        const userId = controller.getSnapshot().user?.id;
        if (!userId) {
          throw new Error("No authenticated user is available.");
        }
        const nextProfile = await repository.completeBasicProfile(userId, input);
        await client.auth.updateUser({
          data: {
            display_name: nextProfile.displayName,
            full_name: nextProfile.displayName,
            username: nextProfile.username
          }
        });
        setAccountProfile(nextProfile);
        setProfileStatus("complete");
        setProfileError(null);
      },
      updateOptionalProfile: async (input) => {
        const userId = controller.getSnapshot().user?.id;
        if (!userId) {
          throw new Error("No authenticated user is available.");
        }
        const nextProfile = await repository.updateOptionalProfile(userId, input);
        if (input.displayName !== undefined || input.username !== undefined) {
          await client.auth.updateUser({
            data: {
              ...(input.displayName !== undefined ? { display_name: nextProfile.displayName, full_name: nextProfile.displayName } : {}),
              ...(input.username !== undefined ? { username: nextProfile.username } : {})
            }
          });
        }
        setAccountProfile(nextProfile);
        setProfileStatus(isBasicAccountProfileComplete(nextProfile) ? "complete" : "required");
        setProfileError(null);
      },
      checkUsernameAvailability: (username, displayName) => {
        const userId = controller.getSnapshot().user?.id ?? null;
        return repository.checkUsernameAvailability(username, userId, displayName);
      },
      refreshAccountProfile,
      requestPasswordReset: (email, redirectTo) => controller.requestPasswordReset(email, redirectTo),
      signOut: async () => {
        await controller.signOut();
        setAccountProfile(null);
        setProfileStatus("anonymous");
        setProfileError(null);
      }
    }),
    [accountProfile, client, controller, env.phoneOtpChannel, profileError, profileStatus, refreshAccountProfile, repository, snapshot]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
