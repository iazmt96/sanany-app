import type { PolicyDocument, PolicySlug } from "./types";
import { termsPolicy } from "./terms";
import { privacyPolicy } from "./privacy";
import { listingPolicy } from "./listing-policy";
import { paymentPolicy } from "./payment-policy";
import { refundPolicy } from "./refund-policy";

export * from "./types";
export { termsPolicy, privacyPolicy, listingPolicy, paymentPolicy, refundPolicy };

export const policyDocuments: Record<PolicySlug, PolicyDocument> = {
  terms: termsPolicy,
  privacy: privacyPolicy,
  "listing-policy": listingPolicy,
  "payment-policy": paymentPolicy,
  "refund-policy": refundPolicy
};

export const policySlugs = Object.keys(policyDocuments) as PolicySlug[];

export function getPolicyDocument(slug: PolicySlug): PolicyDocument {
  return policyDocuments[slug];
}
