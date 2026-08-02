"use client";

import { PropsWithChildren, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { getDirection, type AppLanguage } from "@sanany/utils";
import { AuthProvider } from "./auth/auth-context";
import { getWebI18n } from "./i18n/client";

type AppProvidersProps = PropsWithChildren<{ language: AppLanguage }>;

export function AppProviders({ children, language }: AppProvidersProps) {
  const i18n = getWebI18n();

  useEffect(() => {
    void i18n.changeLanguage(language);
    const direction = getDirection(language);
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [i18n, language]);

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>{children}</AuthProvider>
    </I18nextProvider>
  );
}
