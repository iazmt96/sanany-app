import "./global.css";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { getDirection } from "@sanany/utils";
import { LanguageSwitcher } from "./src/components/language-switcher";
import { AuthScreen } from "./src/screens/auth-screen";
import { MarketplaceScreen } from "./src/screens/marketplace-screen";
import { mobileI18n } from "./src/i18n/mobile-i18n";

export default function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const language = (mobileI18n.language || "ar") as "ar" | "en";
  const direction = getDirection(language);

  return (
    <I18nextProvider i18n={mobileI18n}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.switcherContainer}>
            <LanguageSwitcher />
          </View>
          {sessionActive ? <MarketplaceScreen direction={direction} /> : <AuthScreen onAuthenticated={() => setSessionActive(true)} />}
        </View>
      </SafeAreaView>
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
  }
});
