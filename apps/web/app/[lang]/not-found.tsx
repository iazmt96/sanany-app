import Link from "next/link";
import { resources } from "@sanany/shared";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";

type NotFoundPageProps = {
  params?: Promise<{ lang?: string }>;
};

export default async function LocalizedNotFound({ params }: NotFoundPageProps) {
  const resolvedParams = params ? await params : undefined;
  const lang = resolvedParams?.lang;
  const resolvedLanguage = typeof lang === "string" && isSupportedLanguage(lang) ? lang : defaultLanguage;
  const dictionary = resources[resolvedLanguage].translation;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 text-center">
      <p className="text-xs font-semibold text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{dictionary.common.notFound.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{dictionary.common.notFound.description}</p>
      <Link
        href={`/${resolvedLanguage}`}
        className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        {dictionary.common.notFound.backToHome}
      </Link>
    </section>
  );
}
