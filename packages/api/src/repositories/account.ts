import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountProfile,
  AccountVerificationRequest,
  BasicAccountProfileInput,
  UpdateAccountProfileInput,
  UpsertAccountVerificationInput,
  UsernameAvailability
} from "@sanany/types";
import { buildOptionalProfileUpdate, createUsernameSuggestions, normalizeUsername, resolveUsernameAvailability, validateUsername } from "@sanany/shared";

type AccountProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  phone: string | null;
  account_type: AccountProfile["accountType"] | null;
  is_verified: boolean | null;
};

type AccountPrivateProfileRow = {
  user_id: string;
  birth_date: string | null;
  gender: AccountProfile["gender"] | null;
  preferred_contact_method: AccountProfile["preferredContactMethod"] | null;
};

type VerificationRow = {
  id: string;
  user_id: string;
  status: AccountVerificationRequest["status"];
  legal_full_name: string | null;
  national_id: string | null;
  birth_date: string | null;
  city: string | null;
  email: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  business_name: string | null;
  business_registration: string | null;
  additional_documents: string[] | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapAccountProfile(row: AccountProfileRow, privateRow: AccountPrivateProfileRow | null): AccountProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    city: row.city,
    phone: row.phone,
    birthDate: privateRow?.birth_date ?? null,
    gender: privateRow?.gender ?? null,
    preferredContactMethod: privateRow?.preferred_contact_method ?? null,
    accountType: row.account_type ?? "individual",
    isVerified: row.is_verified ?? false
  };
}

function mapVerification(row: VerificationRow): AccountVerificationRequest {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    legalFullName: row.legal_full_name,
    nationalId: row.national_id,
    birthDate: row.birth_date,
    city: row.city,
    email: row.email,
    documentFrontUrl: row.document_front_url,
    documentBackUrl: row.document_back_url,
    selfieUrl: row.selfie_url,
    businessName: row.business_name,
    businessRegistration: row.business_registration,
    additionalDocuments: row.additional_documents ?? [],
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type AccountRepository = {
  getAccountProfile(userId: string): Promise<AccountProfile | null>;
  checkUsernameAvailability(username: string, excludeUserId?: string | null, displayName?: string): Promise<UsernameAvailability>;
  completeBasicProfile(userId: string, input: BasicAccountProfileInput): Promise<AccountProfile>;
  updateOptionalProfile(userId: string, input: UpdateAccountProfileInput): Promise<AccountProfile>;
  getVerificationRequest(userId: string): Promise<AccountVerificationRequest | null>;
  upsertVerificationRequest(userId: string, input: UpsertAccountVerificationInput): Promise<AccountVerificationRequest>;
};

export function createAccountRepository(client: SupabaseClient): AccountRepository {
  const getAccountProfile: AccountRepository["getAccountProfile"] = async (userId) => {
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
      if (profileResult.error) {
        throw profileResult.error;
      }
      if (privateResult.error) {
        throw privateResult.error;
      }
      return profileResult.data ? mapAccountProfile(profileResult.data as AccountProfileRow, (privateResult.data as AccountPrivateProfileRow | null) ?? null) : null;
    };

  const checkUsernameAvailability: AccountRepository["checkUsernameAvailability"] = async (username, excludeUserId = null, displayName = "") => {
      const validation = validateUsername(username);
      const normalized = validation.normalizedUsername;
      if (!validation.isValid) {
        return resolveUsernameAvailability({ username, isTaken: false, suggestions: createUsernameSuggestions(displayName, normalized) });
      }

      const suggestions = createUsernameSuggestions(displayName, normalized);
      const candidates = Array.from(new Set([normalized, ...suggestions]));
      let query = client.from("profiles").select("id,username").in("username", candidates);
      if (excludeUserId) {
        query = query.neq("id", excludeUserId);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const taken = new Set(((data ?? []) as Array<{ username: string | null }>).map((item) => item.username).filter((value): value is string => Boolean(value)));
      return resolveUsernameAvailability({
        username,
        isTaken: taken.has(normalized),
        suggestions: suggestions.filter((item) => !taken.has(item))
      });
    };

  const completeBasicProfile: AccountRepository["completeBasicProfile"] = async (userId, input) => {
      const normalizedUsername = normalizeUsername(input.username);
      const { error } = await client
        .from("profiles")
        .update({
          display_name: input.displayName.trim(),
          username: normalizedUsername
        })
        .eq("id", userId);
      if (error) {
        throw error;
      }

      const profile = await getAccountProfile(userId);
      if (!profile) {
        throw new Error("Failed to load account profile after completion.");
      }
      return profile;
    };

  const updateOptionalProfile: AccountRepository["updateOptionalProfile"] = async (userId, input) => {
      const normalized = buildOptionalProfileUpdate(input);
      const profilePayload = {
        ...(normalized.displayName !== undefined ? { display_name: normalized.displayName || null } : {}),
        ...(normalized.username !== undefined ? { username: normalized.username || null } : {}),
        ...(normalized.avatarUrl !== undefined ? { avatar_url: normalized.avatarUrl } : {}),
        ...(normalized.bio !== undefined ? { bio: normalized.bio } : {}),
        ...(normalized.city !== undefined ? { city: normalized.city } : {}),
        ...(normalized.phone !== undefined ? { phone: normalized.phone || null } : {})
      };
      const privatePayload = {
        user_id: userId,
        ...(normalized.birthDate !== undefined ? { birth_date: normalized.birthDate } : {}),
        ...(normalized.gender !== undefined ? { gender: normalized.gender } : {}),
        ...(normalized.preferredContactMethod !== undefined ? { preferred_contact_method: normalized.preferredContactMethod } : {})
      };

      if (Object.keys(profilePayload).length > 0) {
        const { error } = await client.from("profiles").update(profilePayload).eq("id", userId);
        if (error) {
          throw error;
        }
      }

      if (Object.keys(privatePayload).length > 1) {
        const { error } = await client.from("account_private_profiles").upsert(privatePayload, { onConflict: "user_id" });
        if (error) {
          throw error;
        }
      }

      const profile = await getAccountProfile(userId);
      if (!profile) {
        throw new Error("Failed to load account profile after update.");
      }
      return profile;
    };

  const getVerificationRequest: AccountRepository["getVerificationRequest"] = async (userId) => {
      const { data, error } = await client
        .from("account_verification_requests")
        .select("id,user_id,status,legal_full_name,national_id,birth_date,city,email,document_front_url,document_back_url,selfie_url,business_name,business_registration,additional_documents,rejection_reason,submitted_at,reviewed_at,created_at,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ? mapVerification(data as VerificationRow) : null;
    };

  const upsertVerificationRequest: AccountRepository["upsertVerificationRequest"] = async (userId, input) => {
      const current = await getVerificationRequest(userId);
      const nextStatus = input.submit ? "pending" : current?.status === "additional_info_required" ? "additional_info_required" : "unverified";
      const payload = {
        user_id: userId,
        status: nextStatus,
        legal_full_name: input.legalFullName.trim(),
        national_id: input.nationalId.trim(),
        birth_date: input.birthDate,
        city: input.city.trim(),
        email: input.email.trim(),
        document_front_url: input.documentFrontUrl ?? null,
        document_back_url: input.documentBackUrl ?? null,
        selfie_url: input.selfieUrl ?? null,
        business_name: input.businessName?.trim() || null,
        business_registration: input.businessRegistration?.trim() || null,
        additional_documents: input.additionalDocuments ?? [],
        rejection_reason: current?.rejectionReason ?? null,
        submitted_at: input.submit ? new Date().toISOString() : current?.submittedAt ?? null
      };

      const { error } = await client.from("account_verification_requests").upsert(payload, { onConflict: "user_id" });
      if (error) {
        throw error;
      }

      const request = await getVerificationRequest(userId);
      if (!request) {
        throw new Error("Failed to load verification request after save.");
      }
      return request;
    };

  return {
    getAccountProfile,
    checkUsernameAvailability,
    completeBasicProfile,
    updateOptionalProfile,
    getVerificationRequest,
    upsertVerificationRequest
  };
}
