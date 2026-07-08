import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "@sanany/shared";
import { defaultLanguage } from "@sanany/utils";

export const mobileI18n = i18next.createInstance();

void mobileI18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  interpolation: { escapeValue: false }
});

