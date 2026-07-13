import Link from "next/link";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { getAdminCategoriesPageData } from "../../../src/admin/categories";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminCategoriesPageProps = {
  searchParams: Promise<{
    group?: string;
    page?: string;
  }>;
};

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminCategoriesPageData({
    group: params.group ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.group) pageBaseParams.set("group", params.group);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.categoriesPanel.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.categoriesPanel.subtitle}</p>
        <p className="mt-2 text-xs text-slate-500">
          {dictionary.admin.categoriesPanel.summary.totalListings.replace("{{count}}", data.totalListings.toLocaleString(language === "ar" ? "ar-SA" : "en-US"))}
        </p>

        <form className="mt-4 grid gap-2 md:grid-cols-[240px_auto]" action="/admin/categories">
          <select
            name="group"
            defaultValue={params.group ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.categoriesPanel.filters.anyGroup}</option>
            {data.overview.map((item) => (
              <option key={item.key} value={item.key}>
                {dictionary.categories.items[item.key]}
              </option>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.overview.map((item) => (
          <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{dictionary.categories.items[item.key]}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{item.listingCount.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {dictionary.admin.categoriesPanel.summary.subcategories.replace("{{count}}", String(item.subcategoryCount))}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {data.errorCode ? (
          <p className="p-4 text-sm text-slate-500">{dictionary.admin.categoriesPanel.dataSourceUnavailable}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-start">{dictionary.admin.categoriesPanel.columns.mainCategory}</th>
                    <th className="px-3 py-2 text-start">{dictionary.admin.categoriesPanel.columns.subcategory}</th>
                    <th className="px-3 py-2 text-start">{dictionary.admin.categoriesPanel.columns.listingsCount}</th>
                    <th className="px-3 py-2 text-start">{dictionary.admin.categoriesPanel.columns.keywords}</th>
                    <th className="px-3 py-2 text-start">{dictionary.admin.categoriesPanel.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const label = dictionary.marketplace.create.categories[row.category];
                    return (
                      <tr key={row.category} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{dictionary.categories.items[row.mainCategory]}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{label}</td>
                        <td className="px-3 py-2 text-slate-700">{row.listingCount.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</td>
                        <td className="px-3 py-2 text-slate-700">{row.keywords.join(language === "ar" ? "، " : ", ")}</td>
                        <td className="px-3 py-2">
                          <Link href={`/admin/listings?q=${encodeURIComponent(label)}`} className="text-xs font-semibold text-brand hover:underline">
                            {dictionary.admin.categoriesPanel.actions.openListings}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.rows.length === 0 ? <p className="p-4 text-sm text-slate-500">{dictionary.admin.search.noResults}</p> : null}
          </>
        )}
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
              return `/admin/categories?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/categories?${next.toString()}`;
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
