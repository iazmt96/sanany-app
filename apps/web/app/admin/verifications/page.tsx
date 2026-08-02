import Link from "next/link";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { getAdminVerificationsPageData } from "../../../src/admin/verifications";
import { formatDateTime } from "../../../src/admin/users";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminVerificationsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

export default async function AdminVerificationsPage({ searchParams }: AdminVerificationsPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "companies.verify")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminVerificationsPageData({
    q: params.q ?? null,
    status: params.status ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.q) pageBaseParams.set("q", params.q);
  if (params.status) pageBaseParams.set("status", params.status);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.verifications.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.verifications.subtitle}</p>

        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_auto]" action="/admin/verifications">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={dictionary.admin.verifications.filters.search}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.verifications.filters.anyStatus}</option>
            <option value="unverified">{dictionary.admin.verifications.status.unverified}</option>
            <option value="pending">{dictionary.admin.verifications.status.pending}</option>
            <option value="verified">{dictionary.admin.verifications.status.verified}</option>
            <option value="rejected">{dictionary.admin.verifications.status.rejected}</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>

        {data.errorCode ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {dictionary.admin.verifications.dataSourceUnavailable}: {data.errorCode}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.companyName}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.representative}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.businessType}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.status}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.city}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.listings}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.requestedAt}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.verifications.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.userId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.companyName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.representativeName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.businessType ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{dictionary.admin.verifications.status[row.verificationStatus]}</td>
                  <td className="px-3 py-2 text-slate-700">{row.city ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.listingsCount}</td>
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(row.requestedAt, language)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/verifications/${row.userId}`} className="text-xs font-semibold text-brand hover:underline">
                      {dictionary.admin.verifications.actions.review}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.rows.length === 0 ? <p className="p-4 text-sm text-slate-500">{dictionary.admin.search.noResults}</p> : null}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <span>
          {dictionary.common.page
            .replace("{{current}}", String(data.page))
            .replace("{{total}}", String(data.totalPages))}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.max(1, data.page - 1)));
              return `/admin/verifications?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/verifications?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page >= data.totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.next}
          </Link>
        </div>
      </div>
    </section>
  );
}
