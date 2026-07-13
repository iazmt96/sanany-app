"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { resources } from "@sanany/shared";
import { type AppLanguage, defaultLanguage, isSupportedLanguage } from "@sanany/utils";

type ListingErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function resolveLanguageFromPath(pathname: string): AppLanguage {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? defaultLanguage;
  return isSupportedLanguage(firstSegment) ? firstSegment : defaultLanguage;
}

export default function ListingError({ error, reset }: ListingErrorProps) {
  const pathname = usePathname();
  const language = resolveLanguageFromPath(pathname);
  const dictionary = resources[language].translation;

  return (
    <section className="rounded-xl border border-red-200 bg-white p-6 text-center">
      <p className="text-xs font-semibold text-red-700">500</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{dictionary.marketplace.loadError}</h1>
      <p className="mt-1 text-sm text-slate-600">{dictionary.marketplace.detail.pageTitle}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
          {dictionary.common.retry}
        </button>
        <Link href={`/${language}/search`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          {dictionary.marketplace.detail.back}
        </Link>
      </div>
      {error.digest ? <p className="mt-3 text-xs text-slate-400">Digest: {error.digest}</p> : null}
    </section>
  );
}
