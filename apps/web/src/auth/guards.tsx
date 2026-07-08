"use client";

import { PropsWithChildren, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isAuthenticated, isAuthPending } from "@sanany/auth";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "./auth-context";

type LanguageProp = {
  language: string;
};

export function RequireAuth({ language, children }: PropsWithChildren<LanguageProp>) {
  const router = useRouter();
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  useEffect(() => {
    if (!isAuthPending(snapshot) && !isAuthenticated(snapshot)) {
      router.replace(`/${resolvedLanguage}/auth`);
    }
  }, [resolvedLanguage, router, snapshot]);

  if (isAuthPending(snapshot)) {
    return <p className="text-sm text-slate-600">{t("common.loading")}</p>;
  }

  if (!isAuthenticated(snapshot)) {
    return null;
  }

  return <>{children}</>;
}

export function RedirectIfAuthenticated({ language, children }: PropsWithChildren<LanguageProp>) {
  const router = useRouter();
  const { snapshot } = useAuth();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  useEffect(() => {
    if (isAuthenticated(snapshot)) {
      router.replace(`/${resolvedLanguage}`);
    }
  }, [resolvedLanguage, router, snapshot]);

  return <>{children}</>;
}

