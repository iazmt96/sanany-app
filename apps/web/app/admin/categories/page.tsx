import Link from "next/link";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { getAdminAuthContext } from "../../../src/admin/auth";
import {
  getAdminCategoriesPageData,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  parseOfferTypeFormValue
} from "../../../src/admin/categories";
import { redirect } from "next/navigation";
import type { ListingOfferType } from "@sanany/types";

type CategoriesPageProps = {
  searchParams: Promise<{ group?: string; page?: string }>;
};

const OFFER_TYPE_LABELS: Record<ListingOfferType, { ar: string; en: string; color: string }> = {
  sell: { ar: "بيع", en: "Sell", color: "bg-blue-100 text-blue-700" },
  rent: { ar: "إيجار", en: "Rent", color: "bg-purple-100 text-purple-700" },
  service: { ar: "خدمة", en: "Service", color: "bg-green-100 text-green-700" },
  request: { ar: "مطلوب", en: "Request", color: "bg-orange-100 text-orange-700" }
};

async function handleCreate(formData: FormData) {
  "use server";
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  const offerType = parseOfferTypeFormValue(formData.get("offerType"));
  const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10);

  await createAdminCategory({ parentId, nameAr, nameEn, offerType, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0 });
  redirect("/admin/categories");
}

async function handleUpdate(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const offerType = parseOfferTypeFormValue(formData.get("offerType"));
  const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10);
  const isActive = formData.get("isActive") === "true";
  const parentId = String(formData.get("parentId") ?? "").trim() || null;

  if (!id) return;
  await updateAdminCategory({ id, slug, nameAr, nameEn, offerType, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0, isActive, parentId });
  redirect("/admin/categories");
}

async function handleDelete(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deleteAdminCategory(id);
  redirect("/admin/categories");
}

export default async function AdminCategoriesPage({ searchParams }: CategoriesPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized") {
    redirect("/admin/login");
  }

  const data = await getAdminCategoriesPageData({
    group: params.group ?? null,
    page: params.page ?? null,
    pageSize: 1000
  });

  const offerTypeOptions: Array<{ value: string; labelAr: string; labelEn: string }> = [
    { value: "", labelAr: "عام (بدون نوع)", labelEn: "General (no type)" },
    { value: "sell", labelAr: "بيع", labelEn: "Sell" },
    { value: "rent", labelAr: "إيجار", labelEn: "Rent" },
    { value: "service", labelAr: "خدمة", labelEn: "Service" },
    { value: "request", labelAr: "مطلوب", labelEn: "Request" }
  ];

  const activeGroup = data.rootOptions.find((root) => root.slug === params.group) ?? null;

  return (
    <section dir="rtl" className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-900">إدارة الأقسام</h1>
            <p className="mt-1 text-sm text-slate-500">
              {data.overview.length} قسم رئيسي &middot; {data.totalItems} فئة فرعية &middot; {data.totalListings.toLocaleString("ar-SA")} إعلان
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; لوحة التحكم
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Error */}
        {data.errorCode && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            خطأ في تحميل البيانات — الكود: {data.errorCode}
          </div>
        )}

        {/* Group filter tabs */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/categories"
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!params.group ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            الكل
          </Link>
          {data.rootOptions.map((root) => (
            <Link
              key={root.id}
              href={`/admin/categories?group=${root.slug}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${params.group === root.slug ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {language === "ar" ? root.labelAr : root.labelEn}
            </Link>
          ))}
        </div>

        {/* Add new category form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">+ إضافة فئة جديدة</h2>
          <form action={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">الاسم بالعربية *</label>
              <input
                name="nameAr"
                required
                placeholder="مثال: سيارات للبيع"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">الاسم بالإنجليزية *</label>
              <input
                name="nameEn"
                required
                placeholder="e.g. Cars for Sale"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">القسم الرئيسي</label>
              <select
                name="parentId"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
              >
                <option value="">قسم رئيسي (بدون أب)</option>
                {data.rootOptions.map((root) => (
                  <option key={root.id} value={root.id}>
                    {language === "ar" ? root.labelAr : root.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">نوع العرض</label>
              <select
                name="offerType"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
              >
                {offerTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === "ar" ? opt.labelAr : opt.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <input type="hidden" name="sortOrder" value="0" />
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                إضافة الفئة
              </button>
            </div>
          </form>
        </div>

        {/* Root categories overview */}
        {data.overview.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.overview.map((item) => (
              <Link
                key={item.id}
                href={`/admin/categories?group=${item.slug}`}
                className={`bg-white rounded-xl border p-3 text-center hover:shadow-sm transition-all ${activeGroup?.id === item.id ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-200"}`}
              >
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {language === "ar" ? item.labelAr : item.labelEn}
                </p>
                <p className="text-xs text-slate-500 mt-1">{item.subcategoryCount} فئة فرعية</p>
                <p className="text-xs text-slate-400">{item.listingCount.toLocaleString("ar-SA")} إعلان</p>
              </Link>
            ))}
          </div>
        )}

        {/* Rows table */}
        {data.rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            لا توجد فئات فرعية بعد
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">الاسم</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">القسم الرئيسي</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">نوع العرض</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">الإعلانات</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">الحقول</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">الحالة</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row) => {
                  const offerLabel = row.offerType ? OFFER_TYPE_LABELS[row.offerType] : null;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{row.labelAr}</p>
                        <p className="text-xs text-slate-400">{row.labelEn}</p>
                        <p className="text-xs text-slate-300 font-mono mt-0.5">{row.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {language === "ar" ? row.mainCategoryLabelAr : row.mainCategoryLabelEn}
                      </td>
                      <td className="px-4 py-3">
                        {offerLabel ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${offerLabel.color}`}>
                            {language === "ar" ? offerLabel.ar : offerLabel.en}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.listingCount > 0 ? (
                          <Link
                            href={`/admin/listings?category=${row.slug}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {row.listingCount.toLocaleString("ar-SA")}
                          </Link>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.fieldsCount > 0 ? (
                          <Link
                            href={`/admin/categories/${row.id}`}
                            className="text-indigo-600 hover:underline font-medium"
                          >
                            {row.fieldsCount}
                          </Link>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                            معطّل
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <details className="relative">
                          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 list-none select-none">
                            ⋮ تعديل
                          </summary>
                          <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3 min-w-72">
                            <form action={handleUpdate} className="space-y-2">
                              <input type="hidden" name="id" value={row.id} />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">الاسم بالعربية</label>
                                  <input
                                    name="nameAr"
                                    defaultValue={row.labelAr}
                                    required
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">الاسم بالإنجليزية</label>
                                  <input
                                    name="nameEn"
                                    defaultValue={row.labelEn}
                                    required
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">Slug</label>
                                  <input
                                    name="slug"
                                    defaultValue={row.slug}
                                    required
                                    dir="ltr"
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-slate-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">الترتيب</label>
                                  <input
                                    name="sortOrder"
                                    type="number"
                                    defaultValue={row.sortOrder}
                                    min={0}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">القسم الرئيسي</label>
                                  <select
                                    name="parentId"
                                    defaultValue={row.parentId ?? ""}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                                  >
                                    <option value="">— بدون أب —</option>
                                    {data.rootOptions.map((root) => (
                                      <option key={root.id} value={root.id}>
                                        {language === "ar" ? root.labelAr : root.labelEn}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">نوع العرض</label>
                                  <select
                                    name="offerType"
                                    defaultValue={row.offerType ?? ""}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                                  >
                                    {offerTypeOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {language === "ar" ? opt.labelAr : opt.labelEn}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  name="isActive"
                                  defaultValue={row.isActive ? "true" : "false"}
                                  className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none"
                                >
                                  <option value="true">نشط</option>
                                  <option value="false">معطّل</option>
                                </select>
                                <button
                                  type="submit"
                                  className="flex-1 px-3 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-700 transition-colors"
                                >
                                  حفظ التعديلات
                                </button>
                              </div>
                            </form>
                            <form action={handleDelete}>
                              <input type="hidden" name="id" value={row.id} />
                              <button
                                type="submit"
                                className="w-full px-3 py-1.5 bg-red-50 text-red-600 text-xs border border-red-200 rounded hover:bg-red-100 transition-colors"
                              >
                                حذف الفئة
                              </button>
                            </form>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
