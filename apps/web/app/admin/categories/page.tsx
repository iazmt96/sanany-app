import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { createAdminCategory, deleteAdminCategory, getAdminCategoriesPageData, parseOfferTypeFormValue, updateAdminCategory } from "../../../src/admin/categories";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminCategoriesPageProps = {
  searchParams: Promise<{
    group?: string;
    page?: string;
    result?: string;
    error?: string;
  }>;
};

function parseIntegerValue(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

async function createCategoryAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    redirect("/admin/categories?result=forbidden");
  }

  const parentId = String(formData.get("parentId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const nameAr = String(formData.get("nameAr") ?? "");
  const nameEn = String(formData.get("nameEn") ?? "");
  const offerType = parseOfferTypeFormValue(formData.get("offerType"));
  const sortOrder = parseIntegerValue(formData.get("sortOrder"));

  try {
    await createAdminCategory({
      parentId: parentId.length > 0 ? parentId : null,
      slug,
      nameAr,
      nameEn,
      offerType,
      sortOrder
    });
  } catch {
    redirect("/admin/categories?result=create-error");
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories?result=created");
}

async function updateCategoryAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    redirect("/admin/categories?result=forbidden");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const parentId = String(formData.get("parentId") ?? "");
  if (!categoryId) {
    redirect("/admin/categories?result=update-error");
  }

  try {
    await updateAdminCategory({
      id: categoryId,
      parentId: parentId.length > 0 ? parentId : null,
      slug: String(formData.get("slug") ?? ""),
      nameAr: String(formData.get("nameAr") ?? ""),
      nameEn: String(formData.get("nameEn") ?? ""),
      offerType: parseOfferTypeFormValue(formData.get("offerType")),
      sortOrder: parseIntegerValue(formData.get("sortOrder")),
      isActive: String(formData.get("isActive") ?? "") === "true"
    });
  } catch {
    redirect("/admin/categories?result=update-error");
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories?result=updated");
}

async function deleteCategoryAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    redirect("/admin/categories?result=forbidden");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) {
    redirect("/admin/categories?result=delete-error");
  }

  try {
    await deleteAdminCategory(categoryId);
  } catch {
    redirect("/admin/categories?result=delete-error");
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories?result=deleted");
}

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
      {params.result === "created" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{dictionary.admin.categoriesPanel.messages.created}</div> : null}
      {params.result === "updated" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{dictionary.admin.categoriesPanel.messages.updated}</div> : null}
      {params.result === "deleted" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{dictionary.admin.categoriesPanel.messages.deleted}</div> : null}
      {params.result === "forbidden" ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{dictionary.admin.categoriesPanel.messages.forbidden}</div> : null}
      {params.result === "create-error" || params.result === "update-error" || params.result === "delete-error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{dictionary.admin.categoriesPanel.messages.operationFailed}</div>
      ) : null}

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
              <option key={item.slug} value={item.slug}>
                {language === "ar" ? item.labelAr : item.labelEn}
              </option>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.categoriesPanel.forms.createTitle}</h3>
        <form action={createCategoryAction} className="mt-4 grid gap-3 md:grid-cols-6">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.parentCategory}</span>
            <select name="parentId" required className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring">
              <option value="">{dictionary.admin.categoriesPanel.forms.selectParent}</option>
              {data.rootOptions.map((rootOption) => (
                <option key={rootOption.id} value={rootOption.id}>
                  {language === "ar" ? rootOption.labelAr : rootOption.labelEn}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.slug}</span>
            <input name="slug" required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.nameAr}</span>
            <input name="nameAr" required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.nameEn}</span>
            <input name="nameEn" required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.offerType}</span>
            <select name="offerType" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring">
              <option value="">{dictionary.admin.categoriesPanel.forms.anyOfferType}</option>
              <option value="sell">sell</option>
              <option value="rent">rent</option>
              <option value="service">service</option>
              <option value="request">request</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.sortOrder}</span>
            <input name="sortOrder" type="number" min={0} defaultValue={0} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring" />
          </label>
          <div className="md:col-span-6">
            <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
              {dictionary.admin.categoriesPanel.forms.createButton}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.overview.map((item) => (
          <div key={item.slug} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{language === "ar" ? item.labelAr : item.labelEn}</p>
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
                    <th className="px-3 py-2 text-start">{dictionary.admin.categoriesPanel.columns.fieldsCount}</th>
                    <th className="px-3 py-2 text-start">{dictionary.admin.categoriesPanel.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const label = language === "ar" ? row.labelAr : row.labelEn;
                    return (
                      <tr key={row.id} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-2 text-slate-700">{language === "ar" ? row.mainCategoryLabelAr : row.mainCategoryLabelEn}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          <form action={updateCategoryAction} className="grid gap-2">
                            <input type="hidden" name="categoryId" value={row.id} />
                            <input type="hidden" name="parentId" value={row.parentId ?? ""} />
                            <input
                              name="slug"
                              defaultValue={row.slug}
                              className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                            />
                            <input
                              name="nameAr"
                              defaultValue={row.labelAr}
                              className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                            />
                            <input
                              name="nameEn"
                              defaultValue={row.labelEn}
                              className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <select name="offerType" defaultValue={row.offerType ?? ""} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring">
                                <option value="">{dictionary.admin.categoriesPanel.forms.anyOfferType}</option>
                                <option value="sell">sell</option>
                                <option value="rent">rent</option>
                                <option value="service">service</option>
                                <option value="request">request</option>
                              </select>
                              <input
                                name="sortOrder"
                                type="number"
                                min={0}
                                defaultValue={row.sortOrder}
                                className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                              />
                              <select name="isActive" defaultValue={row.isActive ? "true" : "false"} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring">
                                <option value="true">{dictionary.admin.categoriesPanel.forms.active}</option>
                                <option value="false">{dictionary.admin.categoriesPanel.forms.inactive}</option>
                              </select>
                            </div>
                            <button type="submit" className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                              {dictionary.admin.categoriesPanel.forms.saveButton}
                            </button>
                          </form>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{row.listingCount.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</td>
                        <td className="px-3 py-2 text-slate-700">{row.fieldsCount.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-2">
                            <Link href={`/admin/listings?q=${encodeURIComponent(label)}`} className="text-xs font-semibold text-brand hover:underline">
                              {dictionary.admin.categoriesPanel.actions.openListings}
                            </Link>
                            <form action={deleteCategoryAction}>
                              <input type="hidden" name="categoryId" value={row.id} />
                              <button type="submit" className="text-xs font-semibold text-rose-600 hover:underline">
                                {dictionary.admin.categoriesPanel.forms.deleteButton}
                              </button>
                            </form>
                          </div>
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
