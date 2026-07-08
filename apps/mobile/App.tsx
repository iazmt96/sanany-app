import "./global.css";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider, useTranslation } from "react-i18next";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { isAuthenticated } from "@sanany/auth";
import { getDirection } from "@sanany/utils";
import { AuthProvider, useAuth } from "./src/auth/auth-context";
import { LanguageSwitcher } from "./src/components/language-switcher";
import { AuthScreen } from "./src/screens/auth-screen";
import { MarketplaceScreen } from "./src/screens/marketplace-screen";
import { mobileI18n } from "./src/i18n/mobile-i18n";

function AppContent() {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const language = (mobileI18n.language || "ar") as "ar" | "en";
  const direction = getDirection(language);

  if (snapshot.status === "loading") {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingLabel}>{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.switcherContainer}>
          <LanguageSwitcher />
        </View>
        {isAuthenticated(snapshot) ? <MarketplaceScreen direction={direction} /> : <AuthScreen />}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={mobileI18n}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <StatusBar style="dark" />
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24
  },
  switcherContainer: {
    marginBottom: 16,
    alignItems: "flex-end"
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingLabel: {
    fontSize: 14,
    color: "#475569"
  }
});
