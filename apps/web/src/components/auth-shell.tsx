"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { AuthAccountType, AuthSignUpMetadata } from "@sanany/types";
import { BUSINESS_TYPE_KEYS, buildSignUpMetadata, resolveAuthErrorKey, validateAuthFormInput } from "@sanany/shared";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { Button, Card, TextInput } from "@sanany/ui";
import { RedirectIfAuthenticated } from "../auth/guards";
import { useAuth } from "../auth/auth-context";
import { LanguageSwitcher } from "./language-switcher";

type AuthShellProps = {
  language: string;
};

type IndividualFields = {
  fullName: string;
};

type CompanyFields = {
  companyName: string;
  representativeName: string;
  businessType: string;
  customBusinessType: string;
  commercialRegistration: string;
  taxNumber: string;
  website: string;
  companyDescription: string;
};

export function AuthShell({ language }: AuthShellProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [isSignIn, setIsSignIn] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [accountType, setAccountType] = useState<AuthAccountType>("individual");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [individualFields, setIndividualFields] = useState<IndividualFields>({ fullName: "" });
  const [companyFields, setCompanyFields] = useState<CompanyFields>({
    companyName: "",
    representativeName: "",
    businessType: "",
    customBusinessType: "",
    commercialRegistration: "",
    taxNumber: "",
    website: "",
    companyDescription: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);

  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const selectedBusinessTypeIsOther = companyFields.businessType === "other";
  const businessTypes = useMemo(
    () =>
      BUSINESS_TYPE_KEYS.map((item) => ({
        value: item,
        label: t(`auth.company.businessTypes.${item}`)
      })),
    [t]
  );

  const clearFeedback = () => {
    setErrorKey(null);
    setInfoKey(null);
  };

  const onRequestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    if (!email.trim()) {
      setErrorKey("auth.errors.emailRequired");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setInfoKey("auth.passwordResetSent");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.errors.unknown");
      setErrorKey(resolveAuthErrorKey(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();

    const formErrorKey = validateAuthFormInput({
      isSignIn,
      accountType,
      email,
      password,
      confirmPassword,
      acceptTerms,
      phone,
      city,
      individualFields,
      companyFields
    });
    if (formErrorKey) {
      setErrorKey(formErrorKey);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignIn) {
        await signIn({ email: email.trim(), password });
        router.replace(`/${resolvedLanguage}`);
      } else {
        const metadata: AuthSignUpMetadata = buildSignUpMetadata({
          accountType,
          phone,
          city,
          individualFields,
          companyFields
        });

        const session = await signUp({
          email: email.trim(),
          password,
          accountType,
          metadata
        });
        if (!session) {
          setInfoKey("auth.emailConfirmationSent");
          return;
        }
        router.replace(`/${resolvedLanguage}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.errors.unknown");
      setErrorKey(resolveAuthErrorKey(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RedirectIfAuthenticated language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-10 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("app.title")}</h1>
          </div>
          <LanguageSwitcher />
        </header>

        <Card className="w-full">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-900">
                  {t(isForgotPassword ? "auth.forgotPasswordTitle" : isSignIn ? "auth.signInTitle" : "auth.signUpTitle")}
                </h2>
                <p className="text-sm text-slate-600">
                  {t(isForgotPassword ? "auth.forgotPasswordSubtitle" : isSignIn ? "auth.subtitle" : "auth.signUpDescription")}
                </p>
                {!isForgotPassword && isSignIn ? <p className="text-xs text-slate-500">{t("auth.legacyAccountHint")}</p> : null}
                {!isForgotPassword && !isSignIn ? <p className="text-xs text-slate-500">{t("auth.verificationHint")}</p> : null}
              </div>

              {!isForgotPassword ? (
                <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
                  {!isSignIn ? (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">{t("auth.signUpAccountTypeLabel")}</span>
                      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label={t("auth.signUpAccountTypeLabel")}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={accountType === "individual"}
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            accountType === "individual" ? "border-teal-600 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-700"
                          }`}
                          onClick={() => setAccountType("individual")}
                        >
                          {t("auth.signUpAccountType.individual")}
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={accountType === "company"}
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            accountType === "company" ? "border-teal-600 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-700"
                          }`}
                          onClick={() => setAccountType("company")}
                        >
                          {t("auth.signUpAccountType.company")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!isSignIn && accountType === "individual" ? (
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{t("auth.fullNameLabel")}</span>
                      <TextInput value={individualFields.fullName} onChange={(event) => setIndividualFields({ fullName: event.target.value })} placeholder={t("auth.fullNamePlaceholder")} />
                    </label>
                  ) : null}

                  {!isSignIn && accountType === "company" ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{t("auth.company.companyNameLabel")}</span>
                          <TextInput value={companyFields.companyName} onChange={(event) => setCompanyFields((current) => ({ ...current, companyName: event.target.value }))} placeholder={t("auth.company.companyNamePlaceholder")} />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{t("auth.company.representativeNameLabel")}</span>
                          <TextInput value={companyFields.representativeName} onChange={(event) => setCompanyFields((current) => ({ ...current, representativeName: event.target.value }))} placeholder={t("auth.company.representativeNamePlaceholder")} />
                        </label>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">{t("auth.company.businessTypeLabel")}</span>
                        <div className="flex flex-wrap gap-2">
                          {businessTypes.map((item) => {
                            const selected = companyFields.businessType === item.value;
                            return (
                              <button
                                key={item.value}
                                type="button"
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                  selected ? "border-teal-600 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"
                                }`}
                                onClick={() => setCompanyFields((current) => ({ ...current, businessType: item.value }))}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {selectedBusinessTypeIsOther ? (
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{t("auth.company.customBusinessTypeLabel")}</span>
                          <TextInput value={companyFields.customBusinessType} onChange={(event) => setCompanyFields((current) => ({ ...current, customBusinessType: event.target.value }))} placeholder={t("auth.company.customBusinessTypePlaceholder")} />
                        </label>
                      ) : null}
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{t("auth.company.commercialRegistrationLabel")}</span>
                          <TextInput value={companyFields.commercialRegistration} onChange={(event) => setCompanyFields((current) => ({ ...current, commercialRegistration: event.target.value }))} placeholder={t("auth.company.commercialRegistrationPlaceholder")} />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{t("auth.company.taxNumberLabel")}</span>
                          <TextInput value={companyFields.taxNumber} onChange={(event) => setCompanyFields((current) => ({ ...current, taxNumber: event.target.value }))} placeholder={t("auth.company.taxNumberPlaceholder")} />
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{t("auth.company.websiteLabel")}</span>
                          <TextInput value={companyFields.website} onChange={(event) => setCompanyFields((current) => ({ ...current, website: event.target.value }))} placeholder={t("auth.company.websitePlaceholder")} />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{t("auth.cityLabel")}</span>
                          <TextInput value={city} onChange={(event) => setCity(event.target.value)} placeholder={t("auth.cityPlaceholder")} />
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">{t("auth.company.descriptionLabel")}</span>
                        <textarea
                          className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-brand/30 transition focus:border-brand focus:ring"
                          value={companyFields.companyDescription}
                          onChange={(event) => setCompanyFields((current) => ({ ...current, companyDescription: event.target.value }))}
                          placeholder={t("auth.company.descriptionPlaceholder")}
                        />
                      </label>
                    </>
                  ) : null}

                  {!isSignIn && accountType === "individual" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">{t("auth.phoneLabel")}</span>
                        <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t("auth.phonePlaceholder")} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">{t("auth.cityLabel")}</span>
                        <TextInput value={city} onChange={(event) => setCity(event.target.value)} placeholder={t("auth.cityPlaceholder")} />
                      </label>
                    </div>
                  ) : null}

                  {!isSignIn && accountType === "company" ? (
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{t("auth.phoneLabel")}</span>
                      <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t("auth.phonePlaceholder")} />
                    </label>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-1 md:col-span-2">
                      <span className="text-sm font-medium text-slate-700">{t("auth.emailLabel")}</span>
                      <TextInput name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("auth.emailPlaceholder")} />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{t("auth.passwordLabel")}</span>
                      <TextInput name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("auth.passwordPlaceholder")} />
                    </label>
                    {!isSignIn ? (
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">{t("auth.confirmPasswordLabel")}</span>
                        <TextInput type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t("auth.confirmPasswordPlaceholder")} />
                      </label>
                    ) : null}
                  </div>

                  {!isSignIn ? (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-teal-600" />
                      <span>{t("auth.termsAgreement")}</span>
                    </label>
                  ) : null}

                  {errorKey ? <p className="text-sm text-red-600">{t(errorKey)}</p> : null}
                  {infoKey ? <p className="text-sm text-emerald-700">{t(infoKey)}</p> : null}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting
                      ? t("common.loading")
                      : t(
                          isSignIn
                            ? "auth.signInAction"
                            : accountType === "company"
                              ? "auth.signUpCompanyAction"
                              : "auth.signUpIndividualAction"
                        )}
                  </Button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={(event) => void onRequestPasswordReset(event)}>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">{t("auth.emailLabel")}</span>
                    <TextInput name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("auth.emailPlaceholder")} />
                  </label>

                  {errorKey ? <p className="text-sm text-red-600">{t(errorKey)}</p> : null}
                  {infoKey ? <p className="text-sm text-emerald-700">{t(infoKey)}</p> : null}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? t("common.loading") : t("auth.forgotPasswordAction")}
                  </Button>
                </form>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {!isForgotPassword ? (
                  <button
                    type="button"
                    className="font-medium text-brand hover:text-brand-dark"
                    onClick={() => {
                      clearFeedback();
                      setIsForgotPassword(true);
                    }}
                  >
                    {t("auth.forgotPasswordLink")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="font-medium text-brand hover:text-brand-dark"
                  onClick={() => {
                    clearFeedback();
                    setIsForgotPassword(false);
                    setIsSignIn((value) => (isForgotPassword ? true : !value));
                  }}
                >
                  {t(isForgotPassword ? "auth.backToSignIn" : isSignIn ? "auth.switchToSignUp" : "auth.switchToSignIn")}
                </button>
              </div>
            </section>

            <aside className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${!isSignIn && accountType === "company" ? "block" : "hidden lg:block"}`}>
              <h3 className="text-base font-semibold text-slate-900">{t("auth.company.webPanelTitle")}</h3>
              <p className="mt-2 text-sm text-slate-600">{t("auth.company.webPanelSubtitle")}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>• {t("auth.company.webPanelItems.verification")}</li>
                <li>• {t("auth.company.webPanelItems.profile")}</li>
                <li>• {t("auth.company.webPanelItems.team")}</li>
              </ul>
            </aside>
          </div>
        </Card>
      </main>
    </RedirectIfAuthenticated>
  );
}
