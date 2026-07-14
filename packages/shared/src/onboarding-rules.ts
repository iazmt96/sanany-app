import type {
  AccountProfile,
  ContactMethod,
  ProfileGender,
  UpdateAccountProfileInput,
  UsernameAvailability
} from "@sanany/types";

export const DEFAULT_COUNTRY_CODE = "+966";
export const OTP_LENGTH = 6;
const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;
const RESERVED_USERNAMES = new Set(["admin", "api", "app", "apps", "auth", "chat", "explore", "home", "login", "logout", "market", "marketplace", "messages", "more", "notifications", "profile", "sanany", "settings", "support", "system", "user", "verification"]);

export type UsernameValidationResult =
  | { isValid: true; normalizedUsername: string }
  | { isValid: false; normalizedUsername: string; errorKey: string };

export type ProfileCompletionItem = {
  id: string;
  completed: boolean;
};

export function normalizePhoneNumber(value: string, defaultCountryCode = DEFAULT_COUNTRY_CODE): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\D/g, "")}`;
  }

  const numeric = digits.replace(/\D/g, "");
  if (numeric.startsWith("966")) {
    return `+${numeric}`;
  }
  if (numeric.startsWith("0")) {
    return `${defaultCountryCode}${numeric.slice(1)}`;
  }
  return `${defaultCountryCode}${numeric}`;
}

export function isValidSaudiPhoneNumber(value: string): boolean {
  return /^\+9665\d{8}$/.test(normalizePhoneNumber(value));
}

export function isValidPhoneNumber(value: string): boolean {
  return /^\+\d{8,15}$/.test(normalizePhoneNumber(value));
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9._]/g, "");
}

export function validateUsername(value: string): UsernameValidationResult {
  const normalizedUsername = normalizeUsername(value);
  if (!normalizedUsername) {
    return { isValid: false, normalizedUsername, errorKey: "auth.phoneOnboarding.errors.usernameRequired" };
  }
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return { isValid: false, normalizedUsername, errorKey: "auth.phoneOnboarding.errors.usernameInvalid" };
  }
  if (RESERVED_USERNAMES.has(normalizedUsername)) {
    return { isValid: false, normalizedUsername, errorKey: "auth.phoneOnboarding.errors.usernameReserved" };
  }
  return { isValid: true, normalizedUsername };
}

export function createUsernameSuggestions(displayName: string, preferredUsername: string): string[] {
  const preferred = normalizeUsername(preferredUsername);
  const baseFromName = normalizeUsername(
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .join(".")
  );
  const base = preferred || baseFromName || "sanany.user";
  const seeds = [base, `${base}.sa`, `${base}.ksa`, `${base}${new Date().getFullYear()}`, `${base}${Math.floor(100 + Math.random() * 900)}`];
  return Array.from(new Set(seeds.map(normalizeUsername).filter((item) => item.length >= 3))).slice(0, 5);
}

export function resolveUsernameAvailability(input: { username: string; isTaken: boolean; suggestions?: string[] }): UsernameAvailability {
  const validation = validateUsername(input.username);
  if (!validation.isValid) {
    return {
      normalizedUsername: validation.normalizedUsername,
      isAvailable: false,
      suggestions: input.suggestions ?? [],
      reason: validation.normalizedUsername ? "invalid" : "empty"
    };
  }

  if (input.isTaken) {
    return {
      normalizedUsername: validation.normalizedUsername,
      isAvailable: false,
      suggestions: input.suggestions ?? [],
      reason: "taken"
    };
  }

  return {
    normalizedUsername: validation.normalizedUsername,
    isAvailable: true,
    suggestions: [],
    reason: "available"
  };
}

export function getProfileCompletionItems(profile: AccountProfile | null, email: string | null | undefined): ProfileCompletionItem[] {
  return [
    { id: "avatar", completed: Boolean(profile?.avatarUrl) },
    { id: "email", completed: Boolean(email?.trim()) },
    { id: "city", completed: Boolean(profile?.city?.trim()) },
    { id: "birthDate", completed: Boolean(profile?.birthDate) },
    { id: "gender", completed: Boolean(profile?.gender) },
    { id: "bio", completed: Boolean(profile?.bio?.trim()) },
    { id: "preferredContactMethod", completed: Boolean(profile?.preferredContactMethod) }
  ];
}

export function getProfileCompletionPercentage(profile: AccountProfile | null, email: string | null | undefined): number {
  const items = getProfileCompletionItems(profile, email);
  const completedCount = items.filter((item) => item.completed).length;
  return Math.round((completedCount / items.length) * 100);
}

export function isBasicAccountProfileComplete(profile: AccountProfile | null): boolean {
  return Boolean(profile?.displayName?.trim() && profile.username?.trim());
}

export function buildOptionalProfileUpdate(input: UpdateAccountProfileInput): UpdateAccountProfileInput {
  return {
    displayName: input.displayName?.trim(),
    username: input.username ? normalizeUsername(input.username) : undefined,
    avatarUrl: input.avatarUrl ?? undefined,
    bio: input.bio?.trim() || null,
    city: input.city?.trim() || null,
    phone: input.phone ? normalizePhoneNumber(input.phone) : undefined,
    birthDate: input.birthDate || null,
    gender: (input.gender as ProfileGender | null | undefined) ?? undefined,
    preferredContactMethod: (input.preferredContactMethod as ContactMethod | null | undefined) ?? undefined
  };
}
