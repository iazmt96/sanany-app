import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type AuthScreenProps = {
  onAuthenticated: () => void;
};

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { t } = useTranslation();
  const [isSignIn, setIsSignIn] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("app.title")}</Text>
      <Text style={styles.subtitle}>{t("auth.subtitle")}</Text>
      <Text style={styles.formTitle}>{t(isSignIn ? "auth.signInTitle" : "auth.signUpTitle")}</Text>

      <View style={styles.fields}>
        <TextInput style={styles.input} placeholder={t("auth.emailPlaceholder")} />
        <TextInput
          style={styles.input}
          placeholder={t("auth.passwordPlaceholder")}
          secureTextEntry
        />
      </View>

      <Pressable style={styles.primaryAction} onPress={onAuthenticated}>
        <Text style={styles.primaryActionLabel}>{t(isSignIn ? "auth.signInAction" : "auth.signUpAction")}</Text>
      </Pressable>

      <Pressable style={styles.switchAction} onPress={() => setIsSignIn((value) => !value)}>
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
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16
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
