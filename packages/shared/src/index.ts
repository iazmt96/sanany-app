import { ar } from "./translations/ar.ts";
import { en } from "./translations/en.ts";
export * from "./car-listing.ts";
export * from "./listing-images.ts";
export * from "./listing-image-upload.ts";
export * from "./listing-draft-queue.ts";
export * from "./commission.ts";
export * from "./commission-review.ts";
export * from "./auth-rules.ts";
export * from "./formatters.ts";
export * from "./account-rules.ts";
export * from "./onboarding-rules.ts";
export * from "./favorites-storage.ts";
export * from "./home-feed.ts";
export * from "./category-tree.ts";
export * from "./permissions.ts";
export * from "./listing-rules.ts";
export * from "./search-filters.ts";
export * from "./profile-rules.ts";
export * from "./listing-management.ts";
export * from "./social-rules.ts";
export * from "./messaging-rules.ts";
export * from "./admin-rbac.ts";
export * from "./listing-attributes.ts";

export const resources = {
  ar: { translation: ar },
  en: { translation: en }
} as const;
