import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
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

  const refreshingForRef = useRef<string | null>(null);

  const refreshAccountProfile = useCallback(async () => {
    const userId = controller.getSnapshot().user?.id;
    if (!userId) {
      setAccountProfile(null);
      setProfileStatus("anonymous");
      setProfileError(null);
      return;
    }

    // Deduplicate: skip if already fetching for this user
    if (refreshingForRef.current === userId) {
      return;
    }
    refreshingForRef.current = userId;

    setProfileStatus("loading");
    setProfileError(null);
    try {
      const profile = await repository.getAccountProfile(userId);
      setAccountProfile(profile);
      setProfileStatus(isBasicAccountProfileComplete(profile) ? "complete" : "required");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message) : "Failed to load account profile.";
      const loweredMessage = errorMessage.toLowerCase();
      if (loweredMessage.includes("website") && loweredMessage.includes("column")) {
        const [profileResult, privateResult] = await Promise.all([
          client
            .from("profiles")
            .select("id,display_name,username,avatar_url,bio,city,phone,account_type,is_verified")
            .eq("id", userId)
            .maybeSingle(),
          client
            .from("account_private_profiles")
            .select("user_id,birth_date,gender,preferred_contact_method")
            .eq("user_id", userId)
            .maybeSingle()
        ]);

        if (!profileResult.error && !privateResult.error && profileResult.data) {
          const profile: AccountProfile = {
            id: profileResult.data.id,
            displayName: profileResult.data.display_name,
            username: profileResult.data.username,
            avatarUrl: profileResult.data.avatar_url,
            bio: profileResult.data.bio,
            website: null,
            city: profileResult.data.city,
            phone: profileResult.data.phone,
            birthDate: privateResult.data?.birth_date ?? null,
            gender: privateResult.data?.gender ?? null,
            preferredContactMethod: privateResult.data?.preferred_contact_method ?? null,
            accountType: profileResult.data.account_type ?? "individual",
            isVerified: profileResult.data.is_verified ?? false
          };
          setAccountProfile(profile);
          setProfileStatus(isBasicAccountProfileComplete(profile) ? "complete" : "required");
          setProfileError(null);
          return;
        }
      }
      setAccountProfile(null);
      setProfileStatus("error");
      setProfileError(errorMessage);
    } finally {
      refreshingForRef.current = null;
    }
  }, [client, controller, repository]);

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
          fallbackChannel: env.phoneOtpChannel === "whatsapp" ? "sms" : "whatsapp"
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
