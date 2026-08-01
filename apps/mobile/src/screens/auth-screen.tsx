import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { OTP_LENGTH, createUsernameSuggestions, isValidPhoneNumber, normalizePhoneNumber, resolveAuthErrorKey, validateUsername } from "@sanany/shared";
import { getDirection } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";

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

export function AuthScreen() {
  const { t, i18n } = useTranslation();
  const {
    accountProfile, checkUsernameAvailability, completeBasicProfile,
    profileError, profileStatus, refreshAccountProfile, requestPasswordReset,
    requestPhoneOtp, signIn, snapshot, verifyPhoneOtp,
  } = useAuth();
  const direction = getDirection((i18n.language || "ar") as "ar" | "en");
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const btnScale = useRef(new Animated.Value(1)).current;

  const [mode, setMode] = useState<AuthMode>("phone");
  const [step, setStep] = useState<OnboardingStep>("phone");
  const [selectedCountryId, setSelectedCountryId] = useState<(typeof COUNTRIES)[number]["id"]>("sa");
  const [isCountryListOpen, setIsCountryListOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [usernameState, setUsernameState] = useState<{
    checking: boolean; isAvailable: boolean; suggestions: string[]; errorKey: string | null;
  }>({ checking: false, isAvailable: false, suggestions: [], errorKey: null });

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
    const timer = setInterval(() => setResendSeconds((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (step !== "profile" || !username) return;
    const handle = setTimeout(() => {
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
    return () => clearTimeout(handle);
  }, [checkUsernameAvailability, displayName, step, t, username]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.location) return;
    const params = new URLSearchParams(typeof window.location.search === "string" ? window.location.search : "");
    const previewStep = params.get("previewStep");
    const previewState = params.get("previewState");
    const previewLang = params.get("previewLang");
    const previewKeyboard = params.get("previewKeyboard");
    if (previewLang === "ar" || previewLang === "en") void i18n.changeLanguage(previewLang);
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
    if (previewKeyboard === "1" && window.document) {
      setTimeout(() => {
        const input = window.document.querySelector("input") as { focus?: () => void } | null;
        if (input && typeof input.focus === "function") input.focus();
      }, 120);
    }
  }, []);

  const clearFeedback = () => { setErrorKey(null); setInfoKey(null); };

  const animateBtn = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  const submitPhone = async () => {
    animateBtn();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearFeedback();
    if (!acceptedTerms) { setErrorKey("auth.errors.termsRequired"); return; }
    if (!normalizedPhone || !isValidPhoneNumber(normalizedPhone)) { setErrorKey("auth.phoneOnboarding.errors.phoneInvalid"); return; }
    setIsSubmitting(true);
    try {
      await requestPhoneOtp({ phone: normalizedPhone });
      setOtpValue(""); setStep("otp"); setResendSeconds(60); setInfoKey("auth.phoneOnboarding.otpSent");
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")));
    } finally { setIsSubmitting(false); }
  };

  const submitOtp = async () => {
    animateBtn();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearFeedback();
    if (otpValue.length !== OTP_LENGTH) { setErrorKey("auth.phoneOnboarding.errors.otpIncomplete"); return; }
    setIsSubmitting(true);
    try {
      await verifyPhoneOtp({ phone: normalizedPhone, token: otpValue });
      await refreshAccountProfile();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInfoKey("auth.phoneOnboarding.otpVerified");
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")));
    } finally { setIsSubmitting(false); }
  };

  const submitBasicProfile = async () => {
    animateBtn();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearFeedback();
    if (!displayName.trim()) { setErrorKey("auth.phoneOnboarding.errors.displayNameRequired"); return; }
    const validation = validateUsername(username);
    if (!validation.isValid) { setErrorKey(validation.errorKey); return; }
    if (!usernameState.isAvailable) { setErrorKey(usernameState.errorKey ?? "auth.phoneOnboarding.errors.usernameTaken"); return; }
    setIsSubmitting(true);
    try {
      await completeBasicProfile({ displayName, username: validation.normalizedUsername });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInfoKey("auth.phoneOnboarding.accountCreated");
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")));
    } finally { setIsSubmitting(false); }
  };

  const submitEmail = async () => {
    animateBtn();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorKey(resolveAuthErrorKey(err instanceof Error ? err.message : t("auth.errors.unknown")));
    } finally { setIsSubmitting(false); }
  };

  const handleOtpCellChange = (index: number, value: string) => {
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
    void Haptics.selectionAsync();
    if (index === OTP_LENGTH - 1 && next.length === OTP_LENGTH) {
      setTimeout(() => void submitOtp(), 120);
    } else if (index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key === "Backspace" && !otpValue[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const otpDigits = Array.from({ length: OTP_LENGTH }, (_, i) => otpValue[i] ?? "");
  const currentStepIndex = PHONE_ONBOARDING_STEPS.indexOf(step) + 1;

  const onCtaPress = () =>
    void (mode === "phone" ? (step === "phone" ? submitPhone() : step === "otp" ? submitOtp() : submitBasicProfile()) : submitEmail());

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Image source={require("../../assets/sanany-logo.png")} style={[styles.logo, isRtl ? styles.logoRtl : undefined]} resizeMode="contain" />

        {/* Title */}
        <Text style={[styles.title, { textAlign }]}>
          {t(mode === "phone" ? step === "phone" ? "auth.phoneOnboarding.title" : step === "otp" ? "auth.phoneOnboarding.otpTitle" : "auth.phoneOnboarding.profileTitle" : isForgotPassword ? "auth.forgotPasswordTitle" : "auth.signInTitle")}
        </Text>
        <Text style={[styles.subtitle, { textAlign }]}>
          {t(mode === "phone" ? step === "phone" ? "auth.phoneOnboarding.subtitle" : step === "otp" ? "auth.phoneOnboarding.otpSubtitle" : "auth.phoneOnboarding.profileSubtitle" : isForgotPassword ? "auth.forgotPasswordSubtitle" : "auth.subtitle")}
        </Text>

        {/* Mode tabs */}
        <View style={[styles.modeTabs]}>
          <Pressable style={[styles.modeTab, mode === "phone" ? styles.modeTabActive : undefined]} onPress={() => { setMode("phone"); clearFeedback(); }}>
            <Text style={[styles.modeTabLabel, mode === "phone" ? styles.modeTabLabelActive : undefined]}>{t("auth.phoneOnboarding.primaryTab")}</Text>
          </Pressable>
          <Pressable style={[styles.modeTab, mode === "email" ? styles.modeTabActive : undefined]} onPress={() => { setMode("email"); clearFeedback(); }}>
            <Text style={[styles.modeTabLabel, mode === "email" ? styles.modeTabLabelActive : undefined]}>{t("auth.phoneOnboarding.secondaryTab")}</Text>
          </Pressable>
        </View>

        {/* Minimal dot progress */}
        {mode === "phone" && (
          <View style={[styles.dotsRow, isRtl ? styles.rowRtl : undefined]}>
            {PHONE_ONBOARDING_STEPS.map((s, i) => {
              const done = i < currentStepIndex - 1;
              const active = s === step;
              return (
                <View key={s} style={styles.dotSegment}>
                  <View style={[styles.dot, active ? styles.dotActive : done ? styles.dotDone : styles.dotInactive, active ? styles.dotLong : undefined]} />
                  {i < PHONE_ONBOARDING_STEPS.length - 1 && (
                    <View style={[styles.dotLine, done ? styles.dotLineDone : undefined]} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Phone step */}
        {mode === "phone" && step === "phone" && (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.phoneOnboarding.phoneStepLabel")}</Text>
            <View style={styles.phoneRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.countrySelector}
                onPress={() => setIsCountryListOpen((c) => !c)}
              >
                <Text style={styles.countrySelectorCode}>{selectedCountry.code}</Text>
              </Pressable>
              <TextInput
                style={[styles.phoneInput, { textAlign }]}
                value={phoneInput}
                onChangeText={(v) => setPhoneInput(formatSaudiPhone(v))}
                placeholder={t("auth.phoneOnboarding.phonePlaceholder")}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>
            {isCountryListOpen && (
              <View style={styles.countryList}>
                {COUNTRIES.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.countryOption, selectedCountryId === c.id ? styles.countryOptionActive : undefined]}
                    onPress={() => { setSelectedCountryId(c.id); setIsCountryListOpen(false); }}
                  >
                    <Text style={styles.countryOptionLabel}>{t(`auth.phoneOnboarding.countries.${c.id}`)}</Text>
                    <Text style={styles.countryOptionCode}>{c.code}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable style={[styles.termsRow, isRtl ? styles.rowRtl : undefined]} onPress={() => setAcceptedTerms((c) => !c)}>
              <View style={[styles.termsCheckbox, acceptedTerms ? styles.termsCheckboxActive : undefined]} />
              <Text style={[styles.termsLabel, { textAlign }]}>{t("auth.phoneOnboarding.termsNotice")}</Text>
            </Pressable>
          </>
        )}

        {/* OTP step */}
        {mode === "phone" && step === "otp" && (
          <>
            <Text style={[styles.helperText, { textAlign }]}>{t("auth.phoneOnboarding.sentTo", { phone: maskPhone(normalizedPhone) })}</Text>
            <View style={styles.otpRow}>
              {otpDigits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(r) => { otpRefs.current[index] = r; }}
                  style={[styles.otpInput, digit ? styles.otpInputFilled : undefined]}
                  value={digit}
                  onChangeText={(v) => handleOtpCellChange(index, v)}
                  onKeyPress={(e) => handleOtpKeyPress(index, e)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  textAlign="center"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                />
              ))}
            </View>
            <View style={[styles.inlineActions, isRtl ? styles.rowRtl : undefined]}>
              <Pressable onPress={() => { setStep("phone"); setOtpValue(""); setResendSeconds(0); clearFeedback(); }}>
                <Text style={styles.inlineActionLabel}>{t("auth.phoneOnboarding.changePhone")}</Text>
              </Pressable>
              <Pressable disabled={resendSeconds > 0 || isSubmitting} onPress={() => void submitPhone()}>
                <Text style={[styles.inlineActionLabel, resendSeconds > 0 ? styles.inlineActionDisabled : undefined]}>
                  {resendSeconds > 0 ? t("auth.phoneOnboarding.resendCountdown", { seconds: resendSeconds }) : t("auth.phoneOnboarding.resend")}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Profile step */}
        {mode === "phone" && step === "profile" && (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.phoneOnboarding.displayNameLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t("auth.phoneOnboarding.displayNamePlaceholder")}
              autoCapitalize="words"
            />
            <View style={[styles.usernameLabelRow, isRtl ? styles.rowRtl : undefined]}>
              <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.phoneOnboarding.usernameLabel")}</Text>
              <View style={styles.charGuide}>
                <Text style={styles.charGuideText}>a-z · 0-9 · _</Text>
              </View>
            </View>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase())}
              placeholder={t("auth.phoneOnboarding.usernamePlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {usernameState.checking ? (
              <Text style={[styles.helperText, { textAlign }]}>{t("auth.phoneOnboarding.usernameChecking")}</Text>
            ) : null}
            {!usernameState.checking && usernameState.isAvailable ? (
              <Text style={[styles.successLabel, { textAlign }]}>✓ {t("auth.phoneOnboarding.usernameAvailable")}</Text>
            ) : null}
            {!usernameState.checking && usernameState.errorKey ? (
              <Text style={[styles.errorLabel, { textAlign }]}>{t(usernameState.errorKey)}</Text>
            ) : null}
            {usernameState.suggestions.length > 0 ? (
              <View style={[styles.suggestionsRow, isRtl ? styles.rowRtl : undefined]}>
                {usernameState.suggestions.map((s) => (
                  <Pressable key={s} style={styles.suggestionChip} onPress={() => setUsername(s)}>
                    <Text style={styles.suggestionChipLabel}>@{s}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* Email mode */}
        {mode === "email" && (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.emailLabel")}</Text>
            <TextInput style={[styles.input, { textAlign }]} value={email} onChangeText={setEmail} placeholder={t("auth.emailPlaceholder")} autoCapitalize="none" keyboardType="email-address" />
            {!isForgotPassword && (
              <>
                <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.passwordLabel")}</Text>
                <TextInput style={[styles.input, { textAlign }]} value={password} onChangeText={setPassword} placeholder={t("auth.passwordPlaceholder")} secureTextEntry />
              </>
            )}
            <Pressable onPress={() => setIsForgotPassword((c) => !c)}>
              <Text style={[styles.inlineActionLabel, { textAlign }]}>{t(isForgotPassword ? "auth.backToSignIn" : "auth.forgotPasswordLink")}</Text>
            </Pressable>
          </>
        )}

        {/* Feedback */}
        {profileError ? <Text style={[styles.errorLabel, { textAlign }]}>{profileError}</Text> : null}
        {errorKey ? <Text style={[styles.errorLabel, { textAlign }]}>{t(errorKey)}</Text> : null}
        {infoKey ? <Text style={[styles.infoLabel, { textAlign }]}>{t(infoKey)}</Text> : null}
      </ScrollView>

      {/* Sticky CTA — always above keyboard */}
      <View style={styles.ctaWrap}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable
            style={[styles.primaryAction, isSubmitting ? styles.primaryActionDisabled : undefined]}
            onPress={onCtaPress}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            <Text style={styles.primaryActionLabel}>
              {isSubmitting
                ? t("common.loading")
                : t(mode === "phone"
                    ? step === "phone" ? "auth.phoneOnboarding.continueAction"
                    : step === "otp" ? "auth.phoneOnboarding.verifyAction"
                    : "auth.phoneOnboarding.createAccountAction"
                    : isForgotPassword ? "auth.forgotPasswordAction" : "auth.signInAction")}
            </Text>
          </Pressable>
        </Animated.View>
        {mode === "phone" && step === "phone" && (
          <Text style={styles.trustHint}>{t("auth.phoneOnboarding.trustHint")}</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const TEAL = "#0f766e";
const TEAL_LIGHT = "#f0fdfa";
const BORDER = "#e2e8f0";
const BG_INPUT = "#f8fafc";
const TEXT_MAIN = "#0f172a";
const TEXT_MUTED = "#64748b";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 52, paddingBottom: 24, gap: 12 },
  logo: { width: 130, height: 44, marginBottom: 14, alignSelf: "flex-start" },
  logoRtl: { alignSelf: "flex-end" },
  title: { fontSize: 26, fontWeight: "800", color: TEXT_MAIN, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 14, color: TEXT_MUTED, lineHeight: 22, marginBottom: 10 },
  rowRtl: { flexDirection: "row-reverse" },
  modeTabs: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 14, padding: 4, gap: 4, marginBottom: 18 },
  modeTab: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  modeTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  modeTabLabel: { fontSize: 13, fontWeight: "700", color: "#94a3b8" },
  modeTabLabelActive: { color: TEAL },
  // Dot progress
  dotsRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  dotSegment: { flexDirection: "row", alignItems: "center" },
  dot: { height: 6, width: 6, borderRadius: 3 },
  dotActive: { backgroundColor: TEAL },
  dotLong: { width: 22 },
  dotDone: { backgroundColor: "#5eead4" },
  dotInactive: { backgroundColor: "#dde3ec" },
  dotLine: { height: 2, width: 18, marginHorizontal: 5, backgroundColor: "#dde3ec", borderRadius: 1 },
  dotLineDone: { backgroundColor: "#5eead4" },
  // Fields
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#334155" },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER, backgroundColor: BG_INPUT, paddingHorizontal: 16, fontSize: 15, color: TEXT_MAIN },
  phoneRow: { flexDirection: "row", gap: 10 },
  countrySelector: { minWidth: 74, minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER, backgroundColor: BG_INPUT, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" },
  countrySelectorCode: { fontSize: 14, fontWeight: "800", color: TEAL },
  phoneInput: { flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER, backgroundColor: BG_INPUT, paddingHorizontal: 16, fontSize: 15, color: TEXT_MAIN },
  countryList: { gap: 6, marginBottom: 4 },
  countryOption: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: "#ffffff", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  countryOptionActive: { borderColor: TEAL, backgroundColor: TEAL_LIGHT },
  countryOptionLabel: { fontSize: 13, fontWeight: "600", color: TEXT_MAIN },
  countryOptionCode: { fontSize: 13, color: TEAL, fontWeight: "700" },
  helperText: { fontSize: 12, lineHeight: 19, color: TEXT_MUTED },
  termsRow: { minHeight: 44, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 2 },
  termsCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#cbd5e1", backgroundColor: "#ffffff", marginTop: 1 },
  termsCheckboxActive: { borderColor: TEAL, backgroundColor: TEAL },
  termsLabel: { flex: 1, fontSize: 12, lineHeight: 18, color: "#475569" },
  // OTP
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: 8 },
  otpInput: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: BG_INPUT,
    textAlign: "center",
    writingDirection: "ltr",
    paddingHorizontal: 0,
    fontSize: 21,
    fontWeight: "800",
    color: TEXT_MAIN
  },
  otpInputFilled: { borderColor: TEAL, backgroundColor: TEAL_LIGHT },
  inlineActions: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  inlineActionLabel: { fontSize: 12, fontWeight: "700", color: TEAL },
  inlineActionDisabled: { color: "#94a3b8" },
  // Username
  usernameLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  charGuide: { borderRadius: 6, backgroundColor: "#f1f5f9", paddingHorizontal: 7, paddingVertical: 2 },
  charGuideText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 10, color: TEXT_MUTED },
  suggestionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: { borderRadius: 999, borderWidth: 1, borderColor: "#c7f2e6", backgroundColor: TEAL_LIGHT, paddingHorizontal: 12, paddingVertical: 7 },
  suggestionChipLabel: { fontSize: 12, fontWeight: "700", color: TEAL },
  errorLabel: { fontSize: 12, color: "#dc2626" },
  successLabel: { fontSize: 12, fontWeight: "700", color: "#047857" },
  infoLabel: { fontSize: 12, color: TEAL },
  // Sticky CTA
  ctaWrap: {
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === "ios" ? 34 : 22,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 8,
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TEAL,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryActionDisabled: { opacity: 0.52, shadowOpacity: 0 },
  primaryActionLabel: { fontSize: 16, fontWeight: "800", color: "#ffffff", letterSpacing: 0.1 },
  trustHint: { textAlign: "center", fontSize: 11, color: "#94a3b8" },
});
