import type { AuthAccountType, AuthSignUpMetadata } from "@sanany/types";

export const BUSINESS_TYPE_KEYS = [
  "carShowroom",
  "realEstate",
  "contracting",
  "trading",
  "store",
  "services",
  "transport",
  "factory",
  "farm",
  "other"
] as const;

export type BusinessTypeKey = (typeof BUSINESS_TYPE_KEYS)[number];

export type AuthIndividualFields = {
  fullName: string;
};

export type AuthCompanyFields = {
  companyName: string;
  representativeName: string;
  businessType: string;
  customBusinessType: string;
  commercialRegistration: string;
  taxNumber: string;
  website: string;
  companyDescription: string;
};

export type AuthFormValidationInput = {
  isSignIn: boolean;
  accountType: AuthAccountType;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  phone: string;
  city: string;
  individualFields: AuthIndividualFields;
  companyFields: AuthCompanyFields;
};

export function resolveAuthErrorKey(message: string): string {
  const loweredMessage = message.toLowerCase();
  if (loweredMessage.includes("invalid login credentials")) {
    return "auth.errors.invalidCredentials";
  }
  if (
    (loweredMessage.includes("phone") || loweredMessage.includes("whatsapp")) &&
    (loweredMessage.includes("disabled") ||
      loweredMessage.includes("sms provider") ||
      loweredMessage.includes("whatsapp provider") ||
      loweredMessage.includes("twilio") ||
      loweredMessage.includes("unsupported phone provider") ||
      loweredMessage.includes("unsupported channel") ||
      loweredMessage.includes("error sending sms") ||
      loweredMessage.includes("error sending whatsapp"))
  ) {
    return "auth.phoneOnboarding.errors.phoneAuthUnavailable";
  }
  if (loweredMessage.includes("otp") && (loweredMessage.includes("expired") || loweredMessage.includes("token has expired"))) {
    return "auth.phoneOnboarding.errors.otpExpired";
  }
  if (
    loweredMessage.includes("otp") ||
    loweredMessage.includes("token") ||
    loweredMessage.includes("verification code") ||
    loweredMessage.includes("sms") ||
    loweredMessage.includes("whatsapp")
  ) {
    if (loweredMessage.includes("invalid") || loweredMessage.includes("should be")) {
      return "auth.phoneOnboarding.errors.otpInvalid";
    }
  }
  if (loweredMessage.includes("email not confirmed")) {
    return "auth.errors.emailNotConfirmed";
  }
  if (loweredMessage.includes("email address") && loweredMessage.includes("is invalid")) {
    return "auth.errors.invalidEmail";
  }
  if (loweredMessage.includes("phone number") && loweredMessage.includes("invalid")) {
    return "auth.phoneOnboarding.errors.phoneInvalid";
  }
  if (loweredMessage.includes("already registered") || loweredMessage.includes("user already registered")) {
    return "auth.errors.userExists";
  }
  if (loweredMessage.includes("rate limit") || loweredMessage.includes("over_email_send_rate_limit") || loweredMessage.includes("too many")) {
    return "auth.errors.rateLimited";
  }
  if (loweredMessage.includes("password should be") || loweredMessage.includes("password is too short")) {
    return "auth.errors.passwordTooShort";
  }
  return "auth.errors.unknown";
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateAuthFormInput(input: AuthFormValidationInput): string | null {
  if (!input.email.trim()) {
    return "auth.errors.emailRequired";
  }
  if (!input.password.trim()) {
    return "auth.errors.passwordRequired";
  }

  if (input.isSignIn) {
    return null;
  }

  if (input.password.trim().length < 6) {
    return "auth.errors.passwordTooShort";
  }
  if (input.confirmPassword !== input.password) {
    return "auth.errors.passwordMismatch";
  }
  if (!input.acceptTerms) {
    return "auth.errors.termsRequired";
  }
  if (!input.phone.trim()) {
    return "auth.errors.phoneRequired";
  }
  if (!input.city.trim()) {
    return "auth.errors.cityRequired";
  }

  if (input.accountType === "individual") {
    if (!input.individualFields.fullName.trim()) {
      return "auth.errors.fullNameRequired";
    }
    return null;
  }

  if (!input.companyFields.companyName.trim()) {
    return "auth.errors.companyNameRequired";
  }
  if (!input.companyFields.representativeName.trim()) {
    return "auth.errors.representativeNameRequired";
  }
  if (!input.companyFields.businessType.trim()) {
    return "auth.errors.businessTypeRequired";
  }
  if (input.companyFields.businessType === "other" && !input.companyFields.customBusinessType.trim()) {
    return "auth.errors.customBusinessTypeRequired";
  }
  if (!input.companyFields.commercialRegistration.trim()) {
    return "auth.errors.commercialRegistrationRequired";
  }
  if (!/^\d{8,20}$/.test(input.companyFields.commercialRegistration.trim())) {
    return "auth.errors.invalidCommercialRegistration";
  }
  if (input.companyFields.taxNumber.trim() && !/^\d{8,20}$/.test(input.companyFields.taxNumber.trim())) {
    return "auth.errors.invalidTaxNumber";
  }
  if (input.companyFields.website.trim() && !isValidHttpUrl(input.companyFields.website.trim())) {
    return "auth.errors.invalidWebsite";
  }

  return null;
}

export function buildSignUpMetadata(input: {
  accountType: AuthAccountType;
  phone: string;
  city: string;
  individualFields: AuthIndividualFields;
  companyFields: AuthCompanyFields;
}): AuthSignUpMetadata {
  if (input.accountType === "individual") {
    return {
      displayName: input.individualFields.fullName.trim(),
      phone: input.phone.trim(),
      city: input.city.trim()
    };
  }

  const selectedBusinessTypeIsOther = input.companyFields.businessType.trim() === "other";
  return {
    displayName: input.companyFields.companyName.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    companyName: input.companyFields.companyName.trim(),
    representativeName: input.companyFields.representativeName.trim(),
    businessType: input.companyFields.businessType.trim(),
    customBusinessType: selectedBusinessTypeIsOther ? input.companyFields.customBusinessType.trim() : undefined,
    commercialRegistration: input.companyFields.commercialRegistration.trim(),
    taxNumber: input.companyFields.taxNumber.trim() || undefined,
    website: input.companyFields.website.trim() || undefined,
    companyDescription: input.companyFields.companyDescription.trim() || undefined
  };
}

export function resolveAccountTypeFromMetadata(metadata: unknown): AuthAccountType {
  if (metadata && typeof metadata === "object") {
    const accountType = (metadata as Record<string, unknown>).account_type;
    if (accountType === "company") {
      return "company";
    }
  }

  return "individual";
}
