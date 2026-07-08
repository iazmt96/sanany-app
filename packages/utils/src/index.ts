export const languages = ["ar", "en"] as const;

export type AppLanguage = (typeof languages)[number];
export type Direction = "rtl" | "ltr";

export const defaultLanguage: AppLanguage = "ar";

export function isSupportedLanguage(value: string): value is AppLanguage {
  return (languages as readonly string[]).includes(value);
}

export function getDirection(language: AppLanguage): Direction {
  return language === "ar" ? "rtl" : "ltr";
}

