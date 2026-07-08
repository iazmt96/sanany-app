"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { Button, Card, TextInput } from "@sanany/ui";
import { RedirectIfAuthenticated } from "../auth/guards";
import { useAuth } from "../auth/auth-context";
import { LanguageSwitcher } from "./language-switcher";

type AuthShellProps = {
  language: string;
};

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

export function AuthShell({ language }: AuthShellProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);

  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        router.replace(`/${resolvedLanguage}`);
      } else {
        const session = await signUp({ email: email.trim(), password });
        if (!session) {
          setInfoKey("auth.emailConfirmationSent");
          return;
        }
        router.replace(`/${resolvedLanguage}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.errors.unknown");
      setErrorKey(resolveAuthErrorKey(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RedirectIfAuthenticated language={resolvedLanguage}>
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

          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">{t("auth.emailLabel")}</span>
              <TextInput
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("auth.emailPlaceholder")}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">{t("auth.passwordLabel")}</span>
              <TextInput
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
              />
            </label>

            {errorKey ? <p className="text-sm text-red-600">{t(errorKey)}</p> : null}
            {infoKey ? <p className="text-sm text-emerald-700">{t(infoKey)}</p> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t(isSignIn ? "auth.signInAction" : "auth.signUpAction")}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 text-sm font-medium text-brand hover:text-brand-dark"
            onClick={() => {
              setErrorKey(null);
              setInfoKey(null);
              setIsSignIn((value) => !value);
            }}
          >
            {t(isSignIn ? "auth.switchToSignUp" : "auth.switchToSignIn")}
          </button>
        </Card>
      </main>
    </RedirectIfAuthenticated>
  );
}
