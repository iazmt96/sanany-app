"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter } from "next/navigation";
import { defaultLanguage, languages, type AppLanguage } from "@sanany/utils";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" />
      <path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLanguage = (i18n.language as AppLanguage) || defaultLanguage;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onLanguageChange = (nextLanguage: AppLanguage) => {
    setOpen(false);
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      router.push(`/${nextLanguage}`);
      return;
    }
    segments[0] = nextLanguage;
    router.push(`/${segments.join("/")}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t(`language.${currentLanguage}`)}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100 text-slate-600 transition hover:border-brand/40 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <GlobeIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div
          className={`absolute top-full z-50 mt-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${
            currentLanguage === "ar" ? "left-0" : "right-0"
          }`}
          role="menu"
        >
          {languages.map((language) => (
            <button
              key={language}
              type="button"
              role="menuitem"
              onClick={() => onLanguageChange(language)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition ${
                language === currentLanguage
                  ? "bg-brand/5 font-semibold text-brand"
                  : "text-slate-700 hover:bg-slate-50 hover:text-brand"
              }`}
            >
              {t(`language.${language}`)}
              {language === currentLanguage ? (
                <svg className="h-4 w-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

