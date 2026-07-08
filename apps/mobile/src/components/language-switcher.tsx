import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { defaultLanguage, languages, type AppLanguage } from "@sanany/utils";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.language as AppLanguage) || defaultLanguage;

  return (
    <View style={styles.wrapper}>
      {languages.map((language) => (
        <Pressable
          key={language}
          style={[styles.button, language === currentLanguage ? styles.buttonActive : undefined]}
          onPress={() => {
            void i18n.changeLanguage(language);
          }}
        >
          <Text style={[styles.label, language === currentLanguage ? styles.labelActive : styles.labelInactive]}>{t(`language.${language}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 4
  },
  button: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  buttonActive: {
    backgroundColor: "#0D9488"
  },
  label: {
    fontSize: 14,
    fontWeight: "600"
  },
  labelActive: {
    color: "#ffffff"
  },
  labelInactive: {
    color: "#334155"
  }
});
