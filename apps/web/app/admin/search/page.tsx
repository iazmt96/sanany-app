import Link from "next/link";
import { resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { runAdminGlobalSearch } from "../../../src/admin/search";

type AdminSearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminSearchPage({ searchParams }: AdminSearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">{dictionary.admin.status.forbiddenHint}</p>
      </section>
    );
  }

  const results = await runAdminGlobalSearch({ term: query, role: auth.role });

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.search.title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {query.length > 0 ? dictionary.admin.search.resultsFor.replace("{query}", query) : dictionary.admin.search.emptyPrompt}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.search.groups.users}</h3>
            <Link href="/admin/users" className="text-xs font-semibold text-brand hover:underline">
              {dictionary.admin.search.openSection}
            </Link>
          </div>
          {results.users.length === 0 ? (
            <p className="text-sm text-slate-500">{dictionary.admin.search.noResults}</p>
          ) : (
            <ul className="space-y-2">
              {results.users.map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <Link href={`/admin/users/${row.id}`} className="font-medium text-brand hover:underline">
                    {row.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.search.groups.companies}</h3>
            <Link href="/admin/companies" className="text-xs font-semibold text-brand hover:underline">
              {dictionary.admin.search.openSection}
            </Link>
          </div>
          {results.companies.length === 0 ? (
            <p className="text-sm text-slate-500">{dictionary.admin.search.noResults}</p>
          ) : (
            <ul className="space-y-2">
              {results.companies.map((row) => (
                <li key={row.userId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <Link href={`/admin/companies/${row.userId}`} className="font-medium text-brand hover:underline">
                    {row.companyName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.search.groups.listings}</h3>
            <Link href="/admin/listings" className="text-xs font-semibold text-brand hover:underline">
              {dictionary.admin.search.openSection}
            </Link>
          </div>
          {results.listings.length === 0 ? (
            <p className="text-sm text-slate-500">{dictionary.admin.search.noResults}</p>
          ) : (
            <ul className="space-y-2">
              {results.listings.map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <Link href={`/admin/listings/${row.id}`} className="font-medium text-brand hover:underline">
                    {row.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.search.groups.reports}</h3>
            <Link href="/admin/reports" className="text-xs font-semibold text-brand hover:underline">
              {dictionary.admin.search.openSection}
            </Link>
          </div>
          {results.reports.length === 0 ? (
            <p className="text-sm text-slate-500">{dictionary.admin.search.noResults}</p>
          ) : (
            <ul className="space-y-2">
              {results.reports.map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <Link href={`/admin/reports/${row.id}`} className="font-medium text-brand hover:underline">
                    {row.id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.search.groups.reviews}</h3>
            <Link href="/admin/reviews" className="text-xs font-semibold text-brand hover:underline">
              {dictionary.admin.search.openSection}
            </Link>
          </div>
          {results.reviews.length === 0 ? (
            <p className="text-sm text-slate-500">{dictionary.admin.search.noResults}</p>
          ) : (
            <ul className="space-y-2">
              {results.reviews.map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <Link href={`/admin/reviews/${row.id}`} className="font-medium text-brand hover:underline">
                    {dictionary.admin.search.ratingLabel}: {row.rating}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
