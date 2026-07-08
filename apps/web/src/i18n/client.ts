"use client";

import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "@sanany/shared";
import { defaultLanguage } from "@sanany/utils";

let instance: i18n | null = null;

export function getWebI18n(): i18n {
  if (instance) {
    return instance;
  }

  instance = i18next.createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: defaultLanguage,
    fallbackLng: defaultLanguage,
    interpolation: { escapeValue: false }
  });

  return instance;
}

