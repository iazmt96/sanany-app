import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { AuthAccountType, AuthSignUpMetadata } from "@sanany/types";
import { BUSINESS_TYPE_KEYS, buildSignUpMetadata, resolveAuthErrorKey, validateAuthFormInput } from "@sanany/shared";
import { getDirection } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";

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

export function AuthScreen() {
  const { t, i18n } = useTranslation();
  const { signIn, signUp } = useAuth();
  const direction = getDirection((i18n.language || "ar") as "ar" | "en");
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const [isSignIn, setIsSignIn] = useState(true);
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
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedBusinessTypeIsOther = companyFields.businessType === "other";
  const businessTypes = useMemo(
    () =>
      BUSINESS_TYPE_KEYS.map((item) => ({
        value: item,
        label: t(`auth.company.businessTypes.${item}`)
      })),
    [t]
  );

  const handleSubmit = async () => {
    setErrorKey(null);
    setInfoKey(null);

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
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.errors.unknown");
      setErrorKey(resolveAuthErrorKey(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={require("../../assets/sanany-logo.png")} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={[styles.formTitle, { textAlign }]}>{t(isSignIn ? "auth.signInTitle" : "auth.signUpTitle")}</Text>
      {!isSignIn ? <Text style={[styles.formSubtitle, { textAlign }]}>{t("auth.signUpDescription")}</Text> : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.fields}>
        {!isSignIn ? (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.signUpAccountTypeLabel")}</Text>
            <View style={[styles.accountTypeTabs, isRtl ? styles.accountTypeTabsRtl : undefined]}>
              <Pressable
                style={[styles.accountTypeTab, accountType === "individual" ? styles.accountTypeTabActive : undefined]}
                accessibilityRole="button"
                accessibilityState={{ selected: accountType === "individual" }}
                onPress={() => setAccountType("individual")}
              >
                <Text style={[styles.accountTypeTabLabel, accountType === "individual" ? styles.accountTypeTabLabelActive : undefined]}>
                  {t("auth.signUpAccountType.individual")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.accountTypeTab, accountType === "company" ? styles.accountTypeTabActive : undefined]}
                accessibilityRole="button"
                accessibilityState={{ selected: accountType === "company" }}
                onPress={() => setAccountType("company")}
              >
                <Text style={[styles.accountTypeTabLabel, accountType === "company" ? styles.accountTypeTabLabelActive : undefined]}>
                  {t("auth.signUpAccountType.company")}
                </Text>
              </Pressable>
            </View>
            {accountType === "company" ? <Text style={[styles.companyHint, { textAlign }]}>{t("auth.company.hint")}</Text> : null}
          </>
        ) : null}

        {!isSignIn && accountType === "individual" ? (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.fullNameLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={individualFields.fullName}
              onChangeText={(value) => setIndividualFields({ fullName: value })}
              placeholder={t("auth.fullNamePlaceholder")}
            />
          </>
        ) : null}

        {!isSignIn && accountType === "company" ? (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.companyNameLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={companyFields.companyName}
              onChangeText={(value) => setCompanyFields((current) => ({ ...current, companyName: value }))}
              placeholder={t("auth.company.companyNamePlaceholder")}
            />
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.representativeNameLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={companyFields.representativeName}
              onChangeText={(value) => setCompanyFields((current) => ({ ...current, representativeName: value }))}
              placeholder={t("auth.company.representativeNamePlaceholder")}
            />
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.businessTypeLabel")}</Text>
            <View style={styles.businessTypeWrap}>
              {businessTypes.map((item) => {
                const selected = companyFields.businessType === item.value;
                return (
                  <Pressable
                    key={item.value}
                    style={[styles.businessTypeChip, selected ? styles.businessTypeChipActive : undefined]}
                    onPress={() => setCompanyFields((current) => ({ ...current, businessType: item.value }))}
                  >
                    <Text style={[styles.businessTypeChipLabel, selected ? styles.businessTypeChipLabelActive : undefined]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedBusinessTypeIsOther ? (
              <>
                <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.customBusinessTypeLabel")}</Text>
                <TextInput
                  style={[styles.input, { textAlign }]}
                  value={companyFields.customBusinessType}
                  onChangeText={(value) => setCompanyFields((current) => ({ ...current, customBusinessType: value }))}
                  placeholder={t("auth.company.customBusinessTypePlaceholder")}
                />
              </>
            ) : null}
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.commercialRegistrationLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={companyFields.commercialRegistration}
              onChangeText={(value) => setCompanyFields((current) => ({ ...current, commercialRegistration: value }))}
              keyboardType="number-pad"
              placeholder={t("auth.company.commercialRegistrationPlaceholder")}
            />
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.taxNumberLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={companyFields.taxNumber}
              onChangeText={(value) => setCompanyFields((current) => ({ ...current, taxNumber: value }))}
              keyboardType="number-pad"
              placeholder={t("auth.company.taxNumberPlaceholder")}
            />
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.websiteLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={companyFields.website}
              onChangeText={(value) => setCompanyFields((current) => ({ ...current, website: value }))}
              placeholder={t("auth.company.websitePlaceholder")}
              autoCapitalize="none"
            />
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.company.descriptionLabel")}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { textAlign }]}
              value={companyFields.companyDescription}
              onChangeText={(value) => setCompanyFields((current) => ({ ...current, companyDescription: value }))}
              placeholder={t("auth.company.descriptionPlaceholder")}
              multiline
            />
          </>
        ) : null}

        {!isSignIn ? (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.phoneLabel")}</Text>
            <TextInput style={[styles.input, { textAlign }]} value={phone} onChangeText={setPhone} placeholder={t("auth.phonePlaceholder")} keyboardType="phone-pad" />
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.cityLabel")}</Text>
            <TextInput style={[styles.input, { textAlign }]} value={city} onChangeText={setCity} placeholder={t("auth.cityPlaceholder")} />
          </>
        ) : null}

        <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.emailLabel")}</Text>
        <TextInput style={[styles.input, { textAlign }]} value={email} onChangeText={setEmail} placeholder={t("auth.emailPlaceholder")} autoCapitalize="none" />
        <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.passwordLabel")}</Text>
        <TextInput style={[styles.input, { textAlign }]} value={password} onChangeText={setPassword} placeholder={t("auth.passwordPlaceholder")} secureTextEntry />
        {!isSignIn ? (
          <>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("auth.confirmPasswordLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              secureTextEntry
            />
            <Pressable style={[styles.termsRow, isRtl ? styles.termsRowRtl : undefined]} onPress={() => setAcceptTerms((value) => !value)}>
              <View style={[styles.termsCheckbox, acceptTerms ? styles.termsCheckboxActive : undefined]} />
              <Text style={[styles.termsLabel, { textAlign }]}>{t("auth.termsAgreement")}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {errorKey ? <Text style={[styles.errorLabel, { textAlign }]}>{t(errorKey)}</Text> : null}
      {infoKey ? <Text style={[styles.infoLabel, { textAlign }]}>{t(infoKey)}</Text> : null}

      <Pressable style={styles.primaryAction} onPress={() => void handleSubmit()} disabled={isSubmitting}>
        <Text style={styles.primaryActionLabel}>
          {isSubmitting
            ? t("common.loading")
            : t(
                isSignIn
                  ? "auth.signInAction"
                  : accountType === "company"
                    ? "auth.signUpCompanyAction"
                    : "auth.signUpIndividualAction"
              )}
        </Text>
      </Pressable>

      <Pressable
        style={styles.switchAction}
        onPress={() => {
          setErrorKey(null);
          setInfoKey(null);
          setIsSignIn((value) => !value);
        }}
      >
        <Text style={styles.switchActionLabel}>{t(isSignIn ? "auth.switchToSignUp" : "auth.switchToSignIn")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "center",
    borderRadius: 28,
    backgroundColor: "#ffffff",
    padding: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  hero: {
    marginBottom: 10,
    alignItems: "center"
  },
  logo: {
    width: "100%",
    height: 84,
    marginBottom: 10
  },
  formTitle: {
    marginBottom: 8,
    marginTop: 8,
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a"
  },
  formSubtitle: {
    marginBottom: 12,
    fontSize: 13,
    color: "#475569"
  },
  fields: {
    gap: 12
  },
  fieldLabel: {
    marginBottom: -8,
    fontSize: 13,
    fontWeight: "500",
    color: "#334155"
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16
  },
  inputMultiline: {
    minHeight: 84
  },
  accountTypeTabs: {
    flexDirection: "row",
    gap: 8
  },
  accountTypeTabsRtl: {
    flexDirection: "row-reverse"
  },
  accountTypeTab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd"
  },
  accountTypeTabActive: {
    borderColor: "#0D9488",
    backgroundColor: "#e6fffb"
  },
  accountTypeTabLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155"
  },
  accountTypeTabLabelActive: {
    color: "#0f766e"
  },
  companyHint: {
    fontSize: 12,
    color: "#475569"
  },
  businessTypeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  businessTypeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  businessTypeChipActive: {
    borderColor: "#0D9488",
    backgroundColor: "#e6fffb"
  },
  businessTypeChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569"
  },
  businessTypeChipLabelActive: {
    color: "#0f766e"
  },
  termsRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  termsRowRtl: {
    flexDirection: "row-reverse"
  },
  termsCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#94a3b8",
    backgroundColor: "#ffffff"
  },
  termsCheckboxActive: {
    borderColor: "#0D9488",
    backgroundColor: "#0D9488"
  },
  termsLabel: {
    flex: 1,
    fontSize: 12,
    color: "#475569"
  },
  errorLabel: {
    marginTop: 12,
    fontSize: 13,
    color: "#dc2626"
  },
  infoLabel: {
    marginTop: 12,
    fontSize: 13,
    color: "#047857"
  },
  primaryAction: {
    marginTop: 16,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#0D9488",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  primaryActionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff"
  },
  switchAction: {
    marginTop: 12
  },
  switchActionLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#0D9488"
  }
});
