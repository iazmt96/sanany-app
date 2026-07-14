"use client";

import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { OTP_LENGTH, createUsernameSuggestions, isValidPhoneNumber, normalizePhoneNumber, resolveAuthErrorKey, validateUsername } from "@sanany/shared";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { RedirectIfAuthenticated } from "../auth/guards";
import { useAuth } from "../auth/auth-context";
import { LanguageSwitcher } from "./language-switcher";

type AuthShellProps = { language: string };
type AuthMode = "phone" | "email";
type OnboardingStep = "phone" | "otp" | "profile";
const PHONE_ONBOARDING_STEPS: readonly OnboardingStep[] = ["phone", "otp", "profile"];

const COUNTRIES = [
  { id: "sa", code: "+966" },
  { id: "ae", code: "+971" },
  { id: "kw", code: "+965" },
  { id: "qa", code: "+974" },
  { id: "bh", code: "+973" },
] as const;

function formatSaudiPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function maskPhone(value: string): string {
  if (value.length <= 4) return value;
  return `${value.slice(0, 4)} ••• ${value.slice(-3)}`;
}

export function AuthShell({ language }: AuthShellProps) {
  const { t } = useTranslation();
  const {
    accountProfile, checkUsernameAvailability, completeBasicProfile,
    profileError, profileStatus, refreshAccountProfile, requestPasswordReset,
    requestPhoneOtp, signIn, snapshot, verifyPhoneOtp,
  } = useAuth();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const isRtl = resolvedLanguage === "ar";
  const [mode, setMode] = useState<AuthMode>("phone");
  const [step, setStep] = useState<OnboardingStep>("phone");
  const [selectedCountryId, setSelectedCountryId] = useState<(typeof COUNTRIES)[number]["id"]>("sa");
  const [phoneInput, setPhoneInput] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [usernameState, setUsernameState] = useState<{
    checking: boolean; isAvailable: boolean; suggestions: string[]; errorKey: string | null;
  }>({ checking: false, isAvailable: false, suggestions: [], errorKey: null });
  const [previewScreen, setPreviewScreen] = useState<"auth" | "splash">("auth");

  const selectedCountry = COUNTRIES.find((c) => c.id === selectedCountryId) ?? COUNTRIES[0];
  const normalizedPhone = useMemo(() => {
    const digits = phoneInput.replace(/\D/g, "");
    if (!digits) return "";
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    return normalizePhoneNumber(`${selectedCountry.code}${local}`);
  }, [phoneInput, selectedCountry.code]);

  useEffect(() => {
    if (profileStatus === "required" && snapshot.user?.id) {
      setMode("phone"); setStep("profile");
      setDisplayName(accountProfile?.displayName ?? "");
      setUsername(accountProfile?.username ?? "");
      setInfoKey("auth.phoneOnboarding.basicInfoRequired");
    }
  }, [accountProfile?.displayName, accountProfile?.username, profileStatus, snapshot.user?.id]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (step !== "profile" || !username) return;
    const handle = window.setTimeout(() => {
      const validation = validateUsername(username);
      if (!validation.isValid) {
        setUsernameState({ checking: false, isAvailable: false, suggestions: createUsernameSuggestions(displayName, username), errorKey: validation.errorKey });
        return;
      }
      setUsernameState((c) => ({ ...c, checking: true, errorKey: null }));
      void checkUsernameAvailability(username, displayName)
        .then((av) => {
          setUsernameState({
            checking: false, isAvailable: av.isAvailable, suggestions: av.suggestions,
            errorKey: av.reason === "taken" ? "auth.phoneOnboarding.errors.usernameTaken" : av.reason === "invalid" ? "auth.phoneOnboarding.errors.usernameInvalid" : null,
          });
        })
        .catch((err) => {
          setUsernameState({ checking: false, isAvailable: false, suggestions: [], errorKey: resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")) });
        });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [checkUsernameAvailability, displayName, step, t, username]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const previewStep = params.get("previewStep");
    const previewState = params.get("previewState");
    const previewScreenParam = params.get("previewScreen");
    const previewKeyboard = params.get("previewKeyboard");
    if (previewScreenParam === "splash") { setPreviewScreen("splash"); return; }
    if (previewStep === "phone" || previewStep === "otp" || previewStep === "profile") {
      setMode("phone"); setStep(previewStep); setPhoneInput("055 123 4567"); setAcceptedTerms(true);
      if (previewStep === "profile") { setDisplayName("مستخدم سنعني"); setUsername("sanany_user"); }
    }
    if (previewState === "error") {
      setErrorKey(previewStep === "otp" ? "auth.phoneOnboarding.errors.otpIncomplete" : previewStep === "profile" ? "auth.phoneOnboarding.errors.usernameTaken" : "auth.phoneOnboarding.errors.phoneInvalid");
      setInfoKey(null); setIsSubmitting(false);
    } else if (previewState === "success") {
      setInfoKey(previewStep === "otp" ? "auth.phoneOnboarding.otpVerified" : previewStep === "profile" ? "auth.phoneOnboarding.accountCreated" : "auth.phoneOnboarding.otpSent");
      setErrorKey(null); setIsSubmitting(false);
    } else if (previewState === "loading") {
      setIsSubmitting(true); setErrorKey(null); setInfoKey(null);
    }
    if (previewKeyboard === "1") {
      window.setTimeout(() => {
        const input = window.document.querySelector("input");
        if (input instanceof HTMLInputElement) input.focus();
      }, 120);
    }
  }, []);

  const clearFeedback = () => { setErrorKey(null); setInfoKey(null); };

  const submitPhone = async () => {
    clearFeedback();
    if (!acceptedTerms) { setErrorKey("auth.errors.termsRequired"); return; }
    if (!normalizedPhone || !isValidPhoneNumber(normalizedPhone)) { setErrorKey("auth.phoneOnboarding.errors.phoneInvalid"); return; }
    setIsSubmitting(true);
    try {
      await requestPhoneOtp({ phone: normalizedPhone });
      setOtpValue(""); setStep("otp"); setResendSeconds(60); setInfoKey("auth.phoneOnboarding.otpSent");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 120);
    } catch (err) {
      setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")));
    } finally { setIsSubmitting(false); }
  };

  const submitOtp = async () => {
    clearFeedback();
    if (otpValue.length !== OTP_LENGTH) { setErrorKey("auth.phoneOnboarding.errors.otpIncomplete"); return; }
    setIsSubmitting(true);
    try {
      await verifyPhoneOtp({ phone: normalizedPhone, token: otpValue });
      await refreshAccountProfile();
      setInfoKey("auth.phoneOnboarding.otpVerified");
    } catch (err) {
      setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")));
    } finally { setIsSubmitting(false); }
  };

  const submitBasicProfile = async () => {
    clearFeedback();
    if (!displayName.trim()) { setErrorKey("auth.phoneOnboarding.errors.displayNameRequired"); return; }
    const validation = validateUsername(username);
    if (!validation.isValid) { setErrorKey(validation.errorKey); return; }
    if (!usernameState.isAvailable) { setErrorKey(usernameState.errorKey ?? "auth.phoneOnboarding.errors.usernameTaken"); return; }
    setIsSubmitting(true);
    try {
      await completeBasicProfile({ displayName, username: validation.normalizedUsername });
      setInfoKey("auth.phoneOnboarding.accountCreated");
    } catch (err) {
      setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")));
    } finally { setIsSubmitting(false); }
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    clearFeedback();
    if (isForgotPassword) {
      if (!email.trim()) { setErrorKey("auth.errors.emailRequired"); return; }
      setIsSubmitting(true);
      try { await requestPasswordReset(email.trim()); setInfoKey("auth.passwordResetSent"); }
      catch (err) { setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown"))); }
      finally { setIsSubmitting(false); }
      return;
    }
    if (!email.trim()) { setErrorKey("auth.errors.emailRequired"); return; }
    if (!password.trim()) { setErrorKey("auth.errors.passwordRequired"); return; }
    setIsSubmitting(true);
    try { await signIn({ email: email.trim(), password }); }
    catch (err) { setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown"))); }
    finally { setIsSubmitting(false); }
  };

  const handleOtpInput = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) { setOtpValue(otpValue.slice(0, index) + otpValue.slice(index + 1)); return; }
    if (digits.length > 1) {
      const next = digits.slice(0, OTP_LENGTH);
      setOtpValue(next);
      otpRefs.current[Math.min(next.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const arr = Array.from({ length: OTP_LENGTH }, (_, i) => otpValue[i] ?? "");
    arr[index] = digits;
    const next = arr.join("").slice(0, OTP_LENGTH);
    setOtpValue(next);
    if (index === OTP_LENGTH - 1 && next.length === OTP_LENGTH) {
      window.setTimeout(() => void submitOtp(), 100);
    } else if (index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const otpDigits = Array.from({ length: OTP_LENGTH }, (_, i) => otpValue[i] ?? "");
  const currentStepIndex = PHONE_ONBOARDING_STEPS.indexOf(step) + 1;

  if (previewScreen === "splash") {
    return (
      <main dir={isRtl ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900">
        <div className="flex flex-col items-center gap-5">
          <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-12 w-auto brightness-0 invert" priority />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-200 opacity-80">{t("auth.phoneOnboarding.sidePanel.eyebrow")}</p>
        </div>
      </main>
    );
  }

  return (
    <RedirectIfAuthenticated language={resolvedLanguage}>
      <main dir={isRtl ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-slate-50">
        {/* Minimal header */}
        <header className="flex items-center justify-between px-6 py-4">
          <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-8 w-auto" priority />
          <LanguageSwitcher />
        </header>

        {/* Centered card */}
        <div className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center">
          <div className="w-full max-w-sm">
            {/* Mode selector */}
            <div className="mb-4 flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {(["phone", "email"] as AuthMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); clearFeedback(); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-150 ${mode === m ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {t(m === "phone" ? "auth.phoneOnboarding.primaryTab" : "auth.phoneOnboarding.secondaryTab")}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              {/* Title */}
              <div className="mb-5">
                <h1 className="text-[1.35rem] font-bold leading-tight text-slate-900">
                  {t(mode === "phone" ? step === "phone" ? "auth.phoneOnboarding.title" : step === "otp" ? "auth.phoneOnboarding.otpTitle" : "auth.phoneOnboarding.profileTitle" : isForgotPassword ? "auth.forgotPasswordTitle" : "auth.signInTitle")}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {t(mode === "phone" ? step === "phone" ? "auth.phoneOnboarding.subtitle" : step === "otp" ? "auth.phoneOnboarding.otpSubtitle" : "auth.phoneOnboarding.profileSubtitle" : isForgotPassword ? "auth.forgotPasswordSubtitle" : "auth.subtitle")}
                </p>
              </div>

              {/* Dot progress — phone mode only */}
              {mode === "phone" && (
                <div className="mb-6 flex items-center gap-1">
                  {PHONE_ONBOARDING_STEPS.map((s, i) => {
                    const done = i < currentStepIndex - 1;
                    const active = s === step;
                    return (
                      <Fragment key={s}>
                        <div className={`h-1.5 rounded-full transition-all duration-300 ${active ? "w-8 bg-teal-600" : done ? "w-2 bg-teal-400" : "w-2 bg-slate-200"}`} />
                        {i < PHONE_ONBOARDING_STEPS.length - 1 && (
                          <div className={`h-px w-5 transition-colors duration-300 ${done ? "bg-teal-300" : "bg-slate-200"}`} />
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              )}

              {/* ── Phone step ── */}
              {mode === "phone" && step === "phone" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("auth.phoneOnboarding.phoneStepLabel")}</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedCountryId}
                        onChange={(e) => setSelectedCountryId(e.target.value as typeof selectedCountryId)}
                        className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-sm font-semibold text-teal-700 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                        aria-label={t("auth.phoneOnboarding.countryCodeLabel")}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.code}</option>
                        ))}
                      </select>
                      <input
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(formatSaudiPhone(e.target.value))}
                        placeholder={t("auth.phoneOnboarding.phonePlaceholder")}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                        inputMode="tel"
                        autoComplete="tel"
                        autoFocus
                        aria-label={t("auth.phoneOnboarding.phoneStepLabel")}
                      />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-600"
                    />
                    <span className="text-xs leading-5 text-slate-500">{t("auth.phoneOnboarding.termsNotice")}</span>
                  </label>
                  {errorKey && <p className="text-sm text-red-500" role="alert">{t(errorKey)}</p>}
                  {infoKey && <p className="text-sm text-teal-700" role="status">{t(infoKey)}</p>}
                  <button
                    type="button"
                    onClick={() => void submitPhone()}
                    disabled={isSubmitting || !acceptedTerms}
                    className="w-full rounded-xl bg-teal-600 px-4 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? t("common.loading") : t("auth.phoneOnboarding.continueAction")}
                  </button>
                  <p className="text-center text-xs text-slate-400">{t("auth.phoneOnboarding.trustHint")}</p>
                </div>
              )}

              {/* ── OTP step ── */}
              {mode === "phone" && step === "otp" && (
                <div className="space-y-5">
                  <p className="text-sm text-slate-500">{t("auth.phoneOnboarding.sentTo", { phone: maskPhone(normalizedPhone) })}</p>
                  <div className="flex justify-between gap-2" dir="ltr" aria-label="OTP input">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(r) => { otpRefs.current[index] = r; }}
                        value={digit}
                        onChange={(e) => handleOtpInput(index, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Backspace" && !otpValue[index] && index > 0) otpRefs.current[index - 1]?.focus(); }}
                        className={`h-14 w-11 rounded-xl border-2 text-center text-xl font-bold text-slate-900 outline-none transition-all duration-150 ${digit ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-slate-50 focus:border-teal-500 focus:bg-white"}`}
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={index === 0 ? OTP_LENGTH : 1}
                        aria-label={`Digit ${index + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <button type="button" onClick={() => { setStep("phone"); setOtpValue(""); setResendSeconds(0); clearFeedback(); }} className="text-teal-600 hover:underline">
                      {t("auth.phoneOnboarding.changePhone")}
                    </button>
                    <button
                      type="button"
                      disabled={resendSeconds > 0 || isSubmitting}
                      onClick={() => void submitPhone()}
                      className={`transition-colors ${resendSeconds > 0 ? "text-slate-400" : "text-teal-600 hover:underline"}`}
                    >
                      {resendSeconds > 0 ? t("auth.phoneOnboarding.resendCountdown", { seconds: resendSeconds }) : t("auth.phoneOnboarding.resend")}
                    </button>
                  </div>
                  {errorKey && <p className="text-sm text-red-500" role="alert">{t(errorKey)}</p>}
                  {infoKey && <p className="text-sm text-teal-700" role="status">{t(infoKey)}</p>}
                  <button
                    type="button"
                    onClick={() => void submitOtp()}
                    disabled={isSubmitting || otpValue.length < OTP_LENGTH}
                    className="w-full rounded-xl bg-teal-600 px-4 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? t("common.loading") : t("auth.phoneOnboarding.verifyAction")}
                  </button>
                </div>
              )}

              {/* ── Profile step ── */}
              {mode === "phone" && step === "profile" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("auth.phoneOnboarding.displayNameLabel")}</label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t("auth.phoneOnboarding.displayNamePlaceholder")}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      autoComplete="name"
                      autoFocus
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">{t("auth.phoneOnboarding.usernameLabel")}</label>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">a-z · 0-9 · _</span>
                    </div>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder={t("auth.phoneOnboarding.usernamePlaceholder")}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <div className="mt-1.5 min-h-[1.25rem]">
                      {usernameState.checking && <p className="text-xs text-slate-400">{t("auth.phoneOnboarding.usernameChecking")}</p>}
                      {!usernameState.checking && usernameState.isAvailable && (
                        <p className="text-xs font-semibold text-teal-600">✓ {t("auth.phoneOnboarding.usernameAvailable")}</p>
                      )}
                      {!usernameState.checking && usernameState.errorKey && (
                        <p className="text-xs text-red-500">{t(usernameState.errorKey)}</p>
                      )}
                    </div>
                    {usernameState.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {usernameState.suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setUsername(s)}
                            className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 active:scale-95"
                          >
                            @{s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {profileError && <p className="text-sm text-red-500" role="alert">{profileError}</p>}
                  {errorKey && <p className="text-sm text-red-500" role="alert">{t(errorKey)}</p>}
                  {infoKey && <p className="text-sm text-teal-700" role="status">{t(infoKey)}</p>}
                  <button
                    type="button"
                    onClick={() => void submitBasicProfile()}
                    disabled={isSubmitting || !displayName.trim() || !usernameState.isAvailable}
                    className="w-full rounded-xl bg-teal-600 px-4 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? t("common.loading") : t("auth.phoneOnboarding.createAccountAction")}
                  </button>
                </div>
              )}

              {/* ── Email mode ── */}
              {mode === "email" && (
                <form className="space-y-4" onSubmit={(e) => void submitEmail(e)}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("auth.emailLabel")}</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      autoComplete="email"
                      type="email"
                    />
                  </div>
                  {!isForgotPassword && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("auth.passwordLabel")}</label>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("auth.passwordPlaceholder")}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                        type="password"
                        autoComplete="current-password"
                      />
                    </div>
                  )}
                  <button type="button" onClick={() => setIsForgotPassword((c) => !c)} className="text-xs font-semibold text-teal-600 hover:underline">
                    {t(isForgotPassword ? "auth.backToSignIn" : "auth.forgotPasswordLink")}
                  </button>
                  {errorKey && <p className="text-sm text-red-500" role="alert">{t(errorKey)}</p>}
                  {infoKey && <p className="text-sm text-teal-700" role="status">{t(infoKey)}</p>}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-teal-600 px-4 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? t("common.loading") : t(isForgotPassword ? "auth.forgotPasswordAction" : "auth.signInAction")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </RedirectIfAuthenticated>
  );
}
