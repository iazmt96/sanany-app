import { ar } from "./translations/ar";
import { en } from "./translations/en";
export * from "./car-listing";
export * from "./listing-images";
export * from "./listing-image-upload";
export * from "./listing-draft-queue";
export * from "./auth-rules";
export * from "./formatters";
export * from "./account-rules";
export * from "./onboarding-rules";
export * from "./favorites-storage";
export * from "./home-feed";
export * from "./permissions";
export * from "./listing-rules";
export * from "./search-filters";
export * from "./profile-rules";
export * from "./listing-management";
export * from "./social-rules";
export * from "./messaging-rules";
export * from "./admin-rbac";

export const resources = {
  ar: { translation: ar },
  en: { translation: en }
} as const;
