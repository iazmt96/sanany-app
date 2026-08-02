import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { createAccountRepository } from "@sanany/api";
import type { AccountVerificationRequest } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileIcon } from "../components/mobile-icons";
import { getMobileSupabaseClient } from "../lib/supabase-client";

type VerificationScreenProps = {
  direction: Direction;
  onBack(): void;
};

export function VerificationScreen({ direction, onBack }: VerificationScreenProps) {
  const { t } = useTranslation();
  const { accountProfile, snapshot } = useAuth();
  const repository = useMemo(() => createAccountRepository(getMobileSupabaseClient()), []);
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const [request, setRequest] = useState<AccountVerificationRequest | null>(null);
  const [form, setForm] = useState({
    legalFullName: "",
    nationalId: "",
    birthDate: "",
    city: "",
    email: "",
    documentFrontUrl: "",
    documentBackUrl: "",
    selfieUrl: "",
    businessName: "",
    businessRegistration: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot.user?.id) {
      return;
    }

    let active = true;
    void repository
      .getVerificationRequest(snapshot.user.id)
      .then((current) => {
        if (!active) {
          return;
        }
        setRequest(current);
        setForm({
          legalFullName: current?.legalFullName ?? accountProfile?.displayName ?? "",
          nationalId: current?.nationalId ?? "",
          birthDate: current?.birthDate ?? accountProfile?.birthDate ?? "",
          city: current?.city ?? accountProfile?.city ?? "",
          email: current?.email ?? snapshot.user?.email ?? "",
          documentFrontUrl: current?.documentFrontUrl ?? "",
          documentBackUrl: current?.documentBackUrl ?? "",
          selfieUrl: current?.selfieUrl ?? "",
          businessName: current?.businessName ?? "",
          businessRegistration: current?.businessRegistration ?? ""
        });
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("auth.errors.unknown"));
        }
      });

    return () => {
      active = false;
    };
  }, [accountProfile?.birthDate, accountProfile?.city, accountProfile?.displayName, repository, snapshot.user?.email, snapshot.user?.id, t]);

  const save = async (submit: boolean) => {
    if (!snapshot.user?.id) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccessKey(null);
    try {
      const nextRequest = await repository.upsertVerificationRequest(snapshot.user.id, {
        legalFullName: form.legalFullName,
        nationalId: form.nationalId,
        birthDate: form.birthDate,
        city: form.city,
        email: form.email,
        documentFrontUrl: form.documentFrontUrl || null,
        documentBackUrl: form.documentBackUrl || null,
        selfieUrl: form.selfieUrl || null,
        businessName: form.businessName || null,
        businessRegistration: form.businessRegistration || null,
        submit
      });
      setRequest(nextRequest);
      setSuccessKey(submit ? "profile.verificationFlow.submit" : "profile.verificationFlow.saveDraft");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("auth.errors.unknown"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={[styles.backButton, isRtl ? styles.rowRtl : undefined]} onPress={onBack}>
        <MobileIcon name="chevron" size={16} color="#334155" />
        <Text style={styles.backButtonLabel}>{t("sellerProfile.back")}</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={[styles.title, { textAlign }]}>{t("profile.verificationFlow.title")}</Text>
        <Text style={[styles.subtitle, { textAlign }]}>{t("profile.verificationFlow.subtitle")}</Text>
        <Text style={[styles.statusPill, { textAlign }]}>
          {t("profile.settings.verification.current", {
            value: request ? t(`profile.verificationFlow.status.${request.status}`) : t("profile.verificationFlow.status.unverified")
          })}
        </Text>
      </View>

      <View style={styles.card}>
        {(["personal", "document", "face", "review", "result"] as const).map((step) => (
          <Text key={step} style={[styles.stepLabel, { textAlign }]}>
            {t(`profile.verificationFlow.steps.${step}`)}
          </Text>
        ))}
      </View>

      <Field label={t("profile.verificationFlow.fields.legalName")} hint={t("profile.verificationFlow.reasons.legalName")} textAlign={textAlign} value={form.legalFullName} onChangeText={(value) => setForm((current) => ({ ...current, legalFullName: value }))} />
      <Field label={t("profile.verificationFlow.fields.nationalId")} hint={t("profile.verificationFlow.reasons.nationalId")} textAlign={textAlign} value={form.nationalId} onChangeText={(value) => setForm((current) => ({ ...current, nationalId: value }))} />
      <Field label={t("profile.verificationFlow.fields.birthDate")} hint={t("profile.verificationFlow.reasons.birthDate")} textAlign={textAlign} value={form.birthDate} onChangeText={(value) => setForm((current) => ({ ...current, birthDate: value }))} placeholder={t("profile.datePlaceholder")} />
      <Field label={t("profile.verificationFlow.fields.city")} hint={t("profile.verificationFlow.reasons.city")} textAlign={textAlign} value={form.city} onChangeText={(value) => setForm((current) => ({ ...current, city: value }))} />
      <Field label={t("profile.verificationFlow.fields.email")} hint={t("profile.verificationFlow.reasons.email")} textAlign={textAlign} value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} autoCapitalize="none" />
      <Field label={t("profile.verificationFlow.fields.documentFront")} hint={t("profile.verificationFlow.reasons.documentFront")} textAlign={textAlign} value={form.documentFrontUrl} onChangeText={(value) => setForm((current) => ({ ...current, documentFrontUrl: value }))} />
      <Field label={t("profile.verificationFlow.fields.documentBack")} hint={t("profile.verificationFlow.reasons.documentBack")} textAlign={textAlign} value={form.documentBackUrl} onChangeText={(value) => setForm((current) => ({ ...current, documentBackUrl: value }))} />
      <Field label={t("profile.verificationFlow.fields.selfie")} hint={t("profile.verificationFlow.reasons.selfie")} textAlign={textAlign} value={form.selfieUrl} onChangeText={(value) => setForm((current) => ({ ...current, selfieUrl: value }))} />
      <Field label={t("profile.verificationFlow.fields.businessName")} hint={t("profile.verificationFlow.reasons.businessName")} textAlign={textAlign} value={form.businessName} onChangeText={(value) => setForm((current) => ({ ...current, businessName: value }))} />
      <Field label={t("profile.verificationFlow.fields.businessRegistration")} hint={t("profile.verificationFlow.reasons.businessRegistration")} textAlign={textAlign} value={form.businessRegistration} onChangeText={(value) => setForm((current) => ({ ...current, businessRegistration: value }))} />

      {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}
      {successKey ? <Text style={[styles.successText, { textAlign }]}>{t(successKey)}</Text> : null}

      <View style={[styles.actionsRow, isRtl ? styles.rowRtl : undefined]}>
        <Pressable style={styles.secondaryAction} onPress={() => void save(false)} disabled={isSaving}>
          <Text style={styles.secondaryActionLabel}>{isSaving ? t("common.loading") : t("profile.verificationFlow.saveDraft")}</Text>
        </Pressable>
        <Pressable style={styles.primaryAction} onPress={() => void save(true)} disabled={isSaving}>
          <Text style={styles.primaryActionLabel}>{isSaving ? t("common.loading") : t("profile.verificationFlow.submit")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  hint,
  textAlign,
  value,
  onChangeText,
  placeholder,
  autoCapitalize
}: {
  label: string;
  hint: string;
  textAlign: "left" | "right";
  value: string;
  onChangeText(value: string): void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.card}>
      <Text style={[styles.fieldLabel, { textAlign }]}>{label}</Text>
      <TextInput
        style={[styles.input, { textAlign }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
      />
      <Text style={[styles.hintText, { textAlign }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 18
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  backButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  card: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: "#64748b"
  },
  statusPill: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  stepLabel: {
    fontSize: 12,
    color: "#334155"
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0f172a"
  },
  hintText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#64748b"
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626"
  },
  successText: {
    fontSize: 12,
    color: "#047857"
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  secondaryActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e"
  },
  primaryActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff"
  }
});
