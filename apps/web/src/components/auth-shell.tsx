"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, TextInput } from "@sanany/ui";
import { LanguageSwitcher } from "./language-switcher";

export function AuthShell() {
  const { t } = useTranslation();
  const [isSignIn, setIsSignIn] = useState(true);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">{t("app.title")}</h1>
        <LanguageSwitcher />
      </header>

      <Card className="mx-auto w-full max-w-md">
        <div className="mb-6 space-y-1">
          <h2 className="text-xl font-semibold">{t(isSignIn ? "auth.signInTitle" : "auth.signUpTitle")}</h2>
          <p className="text-sm text-slate-600">{t("auth.subtitle")}</p>
        </div>

        <form className="space-y-4">
          <TextInput name="email" type="email" placeholder={t("auth.emailPlaceholder")} />
          <TextInput name="password" type="password" placeholder={t("auth.passwordPlaceholder")} />
          <Button type="submit" className="w-full">
            {t(isSignIn ? "auth.signInAction" : "auth.signUpAction")}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm font-medium text-brand hover:text-brand-dark"
          onClick={() => setIsSignIn((value) => !value)}
        >
          {t(isSignIn ? "auth.switchToSignUp" : "auth.switchToSignIn")}
        </button>
      </Card>
    </main>
  );
}

