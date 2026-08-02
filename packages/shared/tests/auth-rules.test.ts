import test from "node:test";
import assert from "node:assert/strict";
import { resolveAccountTypeFromMetadata, validateAuthFormInput } from "../src/auth-rules.ts";

test("validate sign in accepts minimal credentials", () => {
  const result = validateAuthFormInput({
    isSignIn: true,
    accountType: "individual",
    email: "user@example.com",
    password: "123456",
    confirmPassword: "",
    acceptTerms: false,
    phone: "",
    city: "",
    individualFields: { fullName: "" },
    companyFields: {
      companyName: "",
      representativeName: "",
      businessType: "",
      customBusinessType: "",
      commercialRegistration: "",
      taxNumber: "",
      website: "",
      companyDescription: ""
    }
  });

  assert.equal(result, null);
});

test("validate individual sign up requires full name and contact", () => {
  const missingName = validateAuthFormInput({
    isSignIn: false,
    accountType: "individual",
    email: "user@example.com",
    password: "123456",
    confirmPassword: "123456",
    acceptTerms: true,
    phone: "0500000000",
    city: "Riyadh",
    individualFields: { fullName: "" },
    companyFields: {
      companyName: "",
      representativeName: "",
      businessType: "",
      customBusinessType: "",
      commercialRegistration: "",
      taxNumber: "",
      website: "",
      companyDescription: ""
    }
  });

  assert.equal(missingName, "auth.errors.fullNameRequired");
});

test("validate company sign up enforces company fields", () => {
  const missingCommercial = validateAuthFormInput({
    isSignIn: false,
    accountType: "company",
    email: "company@example.com",
    password: "123456",
    confirmPassword: "123456",
    acceptTerms: true,
    phone: "0500000000",
    city: "Riyadh",
    individualFields: { fullName: "" },
    companyFields: {
      companyName: "ACME",
      representativeName: "Rep",
      businessType: "store",
      customBusinessType: "",
      commercialRegistration: "",
      taxNumber: "",
      website: "",
      companyDescription: ""
    }
  });

  assert.equal(missingCommercial, "auth.errors.commercialRegistrationRequired");
});

test("resolveAccountTypeFromMetadata defaults legacy users to individual", () => {
  assert.equal(resolveAccountTypeFromMetadata({}), "individual");
  assert.equal(resolveAccountTypeFromMetadata({ account_type: "company" }), "company");
  assert.equal(resolveAccountTypeFromMetadata({ account_type: "legacy" }), "individual");
});
