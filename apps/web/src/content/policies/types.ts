export type PolicyBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export type PolicySection = {
  id: string;
  title: string;
  blocks: PolicyBlock[];
};

export type PolicyLocaleContent = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro?: string[];
  sections: PolicySection[];
};

export type PolicySlug = "terms" | "privacy" | "listing-policy" | "payment-policy" | "refund-policy";

export type PolicyDocument = {
  slug: PolicySlug;
  ar: PolicyLocaleContent;
  en: PolicyLocaleContent;
};

export const POLICY_CONTACT_EMAIL = "info@sanany.com";
export const POLICY_ORG_NAME_AR = "مؤسسة سنعني للتسويق الالكتروني";
export const POLICY_ORG_NAME_EN = "Sanany Establishment Digital Marketing";
export const POLICY_LAST_UPDATED_AR = "12 سبتمبر 2026";
export const POLICY_LAST_UPDATED_EN = "12 September 2026";
export const POLICY_VERSION = "1.0";
