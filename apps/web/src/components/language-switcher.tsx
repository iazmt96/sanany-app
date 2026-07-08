"use client";

import { useTranslation } from "react-i18next";
import { usePathname, useRouter } from "next/navigation";
import { defaultLanguage, languages, type AppLanguage } from "@sanany/utils";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const currentLanguage = (i18n.language as AppLanguage) || defaultLanguage;

  const onLanguageChange = (nextLanguage: AppLanguage) => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      router.push(`/${nextLanguage}`);
      return;
    }

    segments[0] = nextLanguage;
    router.push(`/${segments.join("/")}`);
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-1">
      {languages.map((language) => (
        <button
          key={language}
          type="button"
          className={`rounded px-3 py-1 text-sm font-medium ${
            language === currentLanguage ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => onLanguageChange(language)}
        >
          {t(`language.${language}`)}
        </button>
      ))}
    </div>
  );
}

