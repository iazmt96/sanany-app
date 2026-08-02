import Link from "next/link";
import { resources } from "@sanany/shared";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";

type ListingNotFoundProps = {
  params: Promise<{ lang: string }>;
};

export default async function ListingNotFound({ params }: ListingNotFoundProps) {
  const { lang } = await params;
  const resolvedLanguage = isSupportedLanguage(lang) ? lang : defaultLanguage;
  const dictionary = resources[resolvedLanguage].translation;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 text-center">
      <p className="text-xs font-semibold text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{dictionary.marketplace.detail.notFound}</h1>
      <Link
        href={`/${resolvedLanguage}/search`}
        className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        {dictionary.marketplace.detail.back}
      </Link>
    </section>
  );
}
