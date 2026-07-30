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
    result?: string;
    error?: string;
  }>;
};

function parseIntegerValue(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function createCategoryAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    redirect("/admin/categories?result=forbidden");
  }

  const parentId = String(formData.get("parentId") ?? "");
  const nameAr = String(formData.get("nameAr") ?? "");
  const nameEn = String(formData.get("nameEn") ?? "");
  const offerType = parseOfferTypeFormValue(formData.get("offerType"));
  const slug = String(formData.get("slug") ?? "");
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
  if (!categoryId) redirect("/admin/categories?result=update-error");

  try {
    await updateAdminCategory({
      id: categoryId,
      parentId: String(formData.get("parentId") ?? "") || null,
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
  if (!categoryId) redirect("/admin/categories?result=delete-error");

  try {
    await deleteAdminCategory(categoryId);
  } catch {
    redirect("/admin/categories?result=delete-error");
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories?result=deleted");
}

const offerTypeLabels: Record<string, string> = {
  sell: "ط¨ظٹط¹",
  rent: "ط¥ظٹط¬ط§ط±",
  service: "ط®ط¯ظ…ط©",
  request: "ط·ظ„ط¨"
};

const offerTypeBadgeColors: Record<string, string> = {
  sell: "bg-emerald-100 text-emerald-800",
  rent: "bg-blue-100 text-blue-800",
  service: "bg-purple-100 text-purple-800",
  request: "bg-amber-100 text-amber-800"
};

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminCategoriesPageData({ group: null, page: null, pageSize: 1000 });

  return (
    <section className="space-y-6" dir="rtl">
      {/* Status messages */}
      {params.result === "created" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          âœ“ طھظ… ط¥ط¶ط§ظپط© ط§ظ„ظپط¦ط© ط¨ظ†ط¬ط§ط­
        </div>
      )}
      {params.result === "updated" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          âœ“ طھظ… طھط­ط¯ظٹط« ط§ظ„ظپط¦ط© ط¨ظ†ط¬ط§ط­
        </div>
      )}
      {params.result === "deleted" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          âœ“ طھظ… ط­ط°ظپ ط§ظ„ظپط¦ط©
        </div>
      )}
      {(params.result === "forbidden" || params.result === "create-error" || params.result === "update-error" || params.result === "delete-error") && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          âœ• ط­ط¯ط« ط®ط·ط£طŒ ظٹط±ط¬ظ‰ ط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط¬ط¯ط¯ط§ظ‹
        </div>
      )}

      {/* Header + stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ط¥ط¯ط§ط±ط© ط§ظ„ظپط¦ط§طھ</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.overview.length} ظپط¦ط© ط±ط¦ظٹط³ظٹط© آ· {data.totalItems} ظپط¦ط© ظپط±ط¹ظٹط© آ· {data.totalListings.toLocaleString("ar-SA")} ط¥ط¹ظ„ط§ظ†
          </p>
        </div>
      </div>

      {/* Add subcategory form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">ط¥ط¶ط§ظپط© ظپط¦ط© ظپط±ط¹ظٹط©</h2>
        <form action={createCategoryAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">ط§ظ„ظپط¦ط© ط§ظ„ط±ط¦ظٹط³ظٹط© *</span>
              <select
                name="parentId"
                required
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              >
                <option value="">ط§ط®طھط± ط§ظ„ظپط¦ط© ط§ظ„ط±ط¦ظٹط³ظٹط©</option>
                {data.rootOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.labelAr}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">ط§ظ„ط§ط³ظ… ط¨ط§ظ„ط¹ط±ط¨ظٹ *</span>
              <input
                name="nameAr"
                required
                placeholder="ظ…ط«ط§ظ„: ط³ظٹط§ط±ط§طھ ط³ظٹط¯ط§ظ†"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">ط§ظ„ط§ط³ظ… ط¨ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹ *</span>
              <input
                name="nameEn"
                required
                placeholder="e.g. Sedans"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
                dir="ltr"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">ظ†ظˆط¹ ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ</span>
              <select
                name="offerType"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              >
                <option value="">ط§ظ„ظƒظ„</option>
                <option value="sell">ط¨ظٹط¹</option>
                <option value="rent">ط¥ظٹط¬ط§ط±</option>
                <option value="service">ط®ط¯ظ…ط©</option>
                <option value="request">ط·ظ„ط¨</option>
              </select>
            </label>
          </div>

          {/* Advanced settings */}
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">
              âڑ™ ط¥ط¹ط¯ط§ط¯ط§طھ ظ…طھظ‚ط¯ظ…ط© (ط§ط®طھظٹط§ط±ظٹ)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">ط±ظ…ط² ط§ظ„ظپط¦ط© (Slug)</span>
                <input
                  name="slug"
                  placeholder="ظٹظڈظˆظ„ظژظ‘ط¯ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ظ…ظ† ط§ظ„ط§ط³ظ… ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹ"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
                  dir="ltr"
                />
                <p className="text-xs text-slate-400">ط§طھط±ظƒظ‡ ظپط§ط±ط؛ط§ظ‹ ظ„ظ„طھظˆظ„ظٹط¯ ط§ظ„طھظ„ظ‚ط§ط¦ظٹ</p>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">طھط±طھظٹط¨ ط§ظ„ط¹ط±ط¶</span>
                <input
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={0}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
                />
              </label>
            </div>
          </details>

          <button
            type="submit"
            className="h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            + ط¥ط¶ط§ظپط© ط§ظ„ظپط¦ط©
          </button>
        </form>
      </div>

      {/* Tree view â€” all subcategories grouped by root */}
      {data.errorCode ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 text-center">
          طھط¹ط°ظ‘ط± طھط­ظ…ظٹظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ
        </div>
      ) : (
        <div className="space-y-4">
          {data.overview.map((root) => {
            const children = data.rows.filter((row) => row.mainCategoryLabelAr === root.labelAr);
            return (
              <div key={root.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Root category header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-slate-900">{root.labelAr}</span>
                    <span className="text-xs text-slate-400">{root.labelEn}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{children.length} ظپط¦ط© ظپط±ط¹ظٹط©</span>
                    <span>{root.listingCount.toLocaleString("ar-SA")} ط¥ط¹ظ„ط§ظ†</span>
                  </div>
                </div>

                {/* Subcategory rows */}
                {children.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">ظ„ط§ طھظˆط¬ط¯ ظپط¦ط§طھ ظپط±ط¹ظٹط© ط¨ط¹ط¯</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {children.map((row) => (
                      <div key={row.id} className="px-5 py-3">
                        {/* Row summary */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className={`inline-block h-2 w-2 rounded-full ${row.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <span className="font-medium text-slate-900">{row.labelAr}</span>
                            <span className="text-xs text-slate-400" dir="ltr">{row.labelEn}</span>
                            {row.offerType && (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${offerTypeBadgeColors[row.offerType] ?? "bg-slate-100 text-slate-700"}`}>
                                {offerTypeLabels[row.offerType] ?? row.offerType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{row.listingCount.toLocaleString("ar-SA")} ط¥ط¹ظ„ط§ظ†</span>
                            <span>{row.fieldsCount} ط­ظ‚ظ„</span>
                            <Link href={`/admin/categories/${row.id}`} className="font-semibold text-indigo-600 hover:underline">
                              ط­ظ‚ظˆظ„
                            </Link>
                            <Link href={`/admin/listings?q=${encodeURIComponent(row.labelAr)}`} className="font-semibold text-brand hover:underline">
                              ط¥ط¹ظ„ط§ظ†ط§طھ
                            </Link>
                          </div>
                        </div>

                        {/* Inline edit form */}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600">
                            طھط¹ط¯ظٹظ„
                          </summary>
                          <form action={updateCategoryAction} className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                            <input type="hidden" name="categoryId" value={row.id} />
                            <input type="hidden" name="parentId" value={row.parentId ?? ""} />
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <label className="space-y-1">
                                <span className="text-xs font-semibold text-slate-600">ط§ظ„ط§ط³ظ… ط¨ط§ظ„ط¹ط±ط¨ظٹ</span>
                                <input
                                  name="nameAr"
                                  defaultValue={row.labelAr}
                                  required
                                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold text-slate-600">ط§ظ„ط§ط³ظ… ط¨ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹ</span>
                                <input
                                  name="nameEn"
                                  defaultValue={row.labelEn}
                                  required
                                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
                                  dir="ltr"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold text-slate-600">ظ†ظˆط¹ ط§ظ„ط¥ط¹ظ„ط§ظ†ط§طھ</span>
                                <select
                                  name="offerType"
                                  defaultValue={row.offerType ?? ""}
                                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
                                >
                                  <option value="">ط§ظ„ظƒظ„</option>
                                  <option value="sell">ط¨ظٹط¹</option>
                                  <option value="rent">ط¥ظٹط¬ط§ط±</option>
                                  <option value="service">ط®ط¯ظ…ط©</option>
                                  <option value="request">ط·ظ„ط¨</option>
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold text-slate-600">ط§ظ„ط­ط§ظ„ط©</span>
                                <select
                                  name="isActive"
                                  defaultValue={row.isActive ? "true" : "false"}
                                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
                                >
                                  <option value="true">ظ†ط´ط·ط©</option>
                                  <option value="false">ظ…ظˆظ‚ظˆظپط©</option>
                                </select>
                              </label>
                            </div>
                            <details className="rounded-lg border border-slate-200 bg-white p-2">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-400">
                                âڑ™ ط¥ط¹ط¯ط§ط¯ط§طھ ظ…طھظ‚ط¯ظ…ط©
                              </summary>
                              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1">
                                  <span className="text-xs font-semibold text-slate-600">ط±ظ…ط² ط§ظ„ظپط¦ط© (Slug)</span>
                                  <input
                                    name="slug"
                                    defaultValue={row.slug}
                                    required
                                    className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                                    dir="ltr"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-xs font-semibold text-slate-600">طھط±طھظٹط¨ ط§ظ„ط¹ط±ط¶</span>
                                  <input
                                    name="sortOrder"
                                    type="number"
                                    min={0}
                                    defaultValue={row.sortOrder}
                                    className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                                  />
                                </label>
                              </div>
                            </details>
                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                className="h-8 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-dark"
                              >
                                ط­ظپط¸ ط§ظ„طھط¹ط¯ظٹظ„ط§طھ
                              </button>
                              <form action={deleteCategoryAction} className="inline">
                                <input type="hidden" name="categoryId" value={row.id} />
                                <button
                                  type="submit"
                                  className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                >
                                  حذف
                                </button>
                              </form>
                            </div>
                          </form>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

