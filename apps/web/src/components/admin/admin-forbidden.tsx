import Link from "next/link";
import { resources } from "@sanany/shared";
import type { AppLanguage } from "@sanany/utils";

type AdminForbiddenProps = {
  language: AppLanguage;
};

export function AdminForbidden({ language }: AdminForbiddenProps) {
  const dictionary = resources[language].translation;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.status.forbiddenTitle}</h2>
      <p className="mt-2 text-sm text-slate-600">{dictionary.admin.status.forbiddenHint}</p>
      <Link
        href={`/${language}`}
        className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        {dictionary.admin.status.backToMarketplace}
      </Link>
    </section>
  );
}
