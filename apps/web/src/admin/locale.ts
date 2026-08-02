import { cookies } from "next/headers";
import { defaultLanguage, isSupportedLanguage, type AppLanguage } from "@sanany/utils";

const LANGUAGE_COOKIE_KEYS = ["sanany-language", "i18next", "NEXT_LOCALE"] as const;

export async function resolveAdminLanguage(): Promise<AppLanguage> {
  const store = await cookies();
  for (const key of LANGUAGE_COOKIE_KEYS) {
    const value = store.get(key)?.value;
    if (typeof value === "string" && isSupportedLanguage(value)) {
      return value;
    }
  }
  return defaultLanguage;
}
