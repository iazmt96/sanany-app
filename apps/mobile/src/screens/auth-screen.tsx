import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/auth-context";

function resolveAuthErrorKey(message: string): string {
  const loweredMessage = message.toLowerCase();
  if (loweredMessage.includes("invalid login credentials")) {
    return "auth.errors.invalidCredentials";
  }

  if (loweredMessage.includes("email not confirmed")) {
    return "auth.errors.emailNotConfirmed";
  }

  if (loweredMessage.includes("email address") && loweredMessage.includes("is invalid")) {
    return "auth.errors.invalidEmail";
  }

  if (loweredMessage.includes("already registered")) {
    return "auth.errors.userExists";
  }

  return "auth.errors.unknown";
}

export function AuthScreen() {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setErrorKey(null);
    setInfoKey(null);

    if (!email.trim()) {
      setErrorKey("auth.errors.emailRequired");
      return;
    }

    if (!password.trim()) {
      setErrorKey("auth.errors.passwordRequired");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignIn) {
        await signIn({ email: email.trim(), password });
      } else {
        const session = await signUp({ email: email.trim(), password });
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
      <Text style={styles.title}>{t("app.title")}</Text>
      <Text style={styles.subtitle}>{t("auth.subtitle")}</Text>
      <Text style={styles.formTitle}>{t(isSignIn ? "auth.signInTitle" : "auth.signUpTitle")}</Text>

      <View style={styles.fields}>
        <Text style={styles.fieldLabel}>{t("auth.emailLabel")}</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t("auth.emailPlaceholder")} autoCapitalize="none" />
        <Text style={styles.fieldLabel}>{t("auth.passwordLabel")}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t("auth.passwordPlaceholder")}
          secureTextEntry
        />
      </View>

      {errorKey ? <Text style={styles.errorLabel}>{t(errorKey)}</Text> : null}
      {infoKey ? <Text style={styles.infoLabel}>{t(infoKey)}</Text> : null}

      <Pressable style={styles.primaryAction} onPress={() => void handleSubmit()} disabled={isSubmitting}>
        <Text style={styles.primaryActionLabel}>{isSubmitting ? t("common.loading") : t(isSignIn ? "auth.signInAction" : "auth.signUpAction")}</Text>
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
    maxWidth: 640,
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 20
  },
  title: {
    marginBottom: 4,
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a"
  },
  subtitle: {
    marginBottom: 16,
    fontSize: 14,
    color: "#475569"
  },
  formTitle: {
    marginBottom: 12,
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a"
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16
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
    borderRadius: 8,
    backgroundColor: "#0D9488",
    paddingHorizontal: 16,
    paddingVertical: 12
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
