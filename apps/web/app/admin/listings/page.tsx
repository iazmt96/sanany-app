import Link from "next/link";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { getAdminListingsPageData } from "../../../src/admin/listings";
import { formatDateTime } from "../../../src/admin/users";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminListingsPageProps = {
  searchParams: Promise<{
    q?: string;
    owner?: string;
    status?: string;
    page?: string;
  }>;
};

export default async function AdminListingsPage({ searchParams }: AdminListingsPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "listings.view")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminListingsPageData({
    q: params.q ?? null,
    owner: params.owner ?? null,
    status: params.status ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.q) pageBaseParams.set("q", params.q);
  if (params.owner) pageBaseParams.set("owner", params.owner);
  if (params.status) pageBaseParams.set("status", params.status);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.listings.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.listings.subtitle}</p>

        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_220px_auto]" action="/admin/listings">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={dictionary.admin.listings.filters.search}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <input
            name="owner"
            defaultValue={params.owner ?? ""}
            placeholder={dictionary.admin.listings.filters.owner}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.listings.filters.anyStatus}</option>
            <option value="draft">{dictionary.admin.listings.status.draft}</option>
            <option value="available">{dictionary.admin.listings.status.available}</option>
            <option value="reserved">{dictionary.admin.listings.status.reserved}</option>
            <option value="inactive">{dictionary.admin.listings.status.inactive}</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.listings.columns.title}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.listings.columns.owner}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.listings.columns.status}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.listings.columns.price}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.listings.columns.location}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.listings.columns.createdAt}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.listings.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.title}</td>
                  <td className="px-3 py-2 text-slate-700">{row.ownerDisplayName}</td>
                  <td className="px-3 py-2 text-slate-700">{dictionary.admin.listings.status[row.status]}</td>
                  <td className="px-3 py-2 text-slate-700">{row.price.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</td>
                  <td className="px-3 py-2 text-slate-700">{row.locationName ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(row.createdAt, language)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/listings/${row.id}`} className="text-xs font-semibold text-brand hover:underline">
                      {dictionary.admin.listings.actions.view}
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
              return `/admin/listings?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/listings?${next.toString()}`;
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
