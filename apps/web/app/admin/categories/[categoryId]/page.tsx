import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../../src/admin/auth";
import {
  createAdminCategoryField,
  deleteAdminCategoryField,
  getAdminCategoryDetail,
  parseBoolean,
  updateAdminCategoryField
} from "../../../../src/admin/categories";
import { resolveAdminLanguage } from "../../../../src/admin/locale";
import { AdminForbidden } from "../../../../src/components/admin/admin-forbidden";

type Params = { categoryId: string };
type PageProps = {
  params: Promise<Params>;
  searchParams: Promise<{ result?: string }>;
};

function parseIntegerValue(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function createFieldAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    redirect("/admin/categories");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) {
    redirect("/admin/categories");
  }

  try {
    await createAdminCategoryField({
      categoryId,
      fieldKey: String(formData.get("fieldKey") ?? ""),
      fieldType: String(formData.get("fieldType") ?? "text"),
      labelAr: String(formData.get("labelAr") ?? ""),
      labelEn: String(formData.get("labelEn") ?? ""),
      placeholderAr: String(formData.get("placeholderAr") ?? "") || null,
      placeholderEn: String(formData.get("placeholderEn") ?? "") || null,
      isRequired: parseBoolean(formData.get("isRequired")),
      filterable: parseBoolean(formData.get("filterable")),
      detailVisible: parseBoolean(formData.get("detailVisible") ?? "true"),
      sortOrder: parseIntegerValue(formData.get("sortOrder")),
      optionsJson: String(formData.get("optionsJson") ?? "[]")
    });
  } catch {
    redirect(`/admin/categories/${categoryId}?result=create-error`);
  }

  revalidatePath(`/admin/categories/${categoryId}`);
  redirect(`/admin/categories/${categoryId}?result=created`);
}

async function updateFieldAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    redirect("/admin/categories");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  if (!categoryId || !fieldId) {
    redirect("/admin/categories");
  }

  try {
    await updateAdminCategoryField({
      fieldId,
      fieldKey: String(formData.get("fieldKey") ?? ""),
      fieldType: String(formData.get("fieldType") ?? "text"),
      labelAr: String(formData.get("labelAr") ?? ""),
      labelEn: String(formData.get("labelEn") ?? ""),
      placeholderAr: String(formData.get("placeholderAr") ?? "") || null,
      placeholderEn: String(formData.get("placeholderEn") ?? "") || null,
      isRequired: parseBoolean(formData.get("isRequired")),
      filterable: parseBoolean(formData.get("filterable")),
      detailVisible: parseBoolean(formData.get("detailVisible") ?? "true"),
      sortOrder: parseIntegerValue(formData.get("sortOrder")),
      optionsJson: String(formData.get("optionsJson") ?? "[]")
    });
  } catch {
    redirect(`/admin/categories/${categoryId}?result=update-error`);
  }

  revalidatePath(`/admin/categories/${categoryId}`);
  redirect(`/admin/categories/${categoryId}?result=updated`);
}

async function deleteFieldAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    redirect("/admin/categories");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  if (!categoryId || !fieldId) {
    redirect("/admin/categories");
  }

  try {
    await deleteAdminCategoryField(fieldId);
  } catch {
    redirect(`/admin/categories/${categoryId}?result=delete-error`);
  }

  revalidatePath(`/admin/categories/${categoryId}`);
  redirect(`/admin/categories/${categoryId}?result=deleted`);
}

const FIELD_TYPES = ["text", "textarea", "number", "select", "multiselect", "boolean"] as const;

export default async function AdminCategoryFieldsPage({ params, searchParams }: PageProps) {
  const { categoryId } = await params;
  const { result } = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "categories.manage")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminCategoryDetail(categoryId);

  if (data.errorCode === "not_found") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-medium text-rose-800">{dictionary.admin.categoryFieldsPanel.notFound}</p>
        <Link href="/admin/categories" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
          ← {dictionary.admin.categoriesPanel.title}
        </Link>
      </div>
    );
  }

  const categoryLabel = language === "ar" ? data.labelAr : data.labelEn;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/categories" className="text-sm font-semibold text-brand hover:underline">
          ← {dictionary.admin.categoriesPanel.title}
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-sm font-semibold text-slate-900">{categoryLabel}</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">{data.slug}</span>
      </div>

      {result === "created" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.categoryFieldsPanel.messages.created}
        </div>
      ) : null}
      {result === "updated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.categoryFieldsPanel.messages.updated}
        </div>
      ) : null}
      {result === "deleted" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.categoryFieldsPanel.messages.deleted}
        </div>
      ) : null}
      {result === "create-error" || result === "update-error" || result === "delete-error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.categoryFieldsPanel.messages.operationFailed}
        </div>
      ) : null}

      {data.errorCode && data.errorCode !== "not_found" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {dictionary.admin.categoriesPanel.dataSourceUnavailable}
        </div>
      ) : null}

      {/* Add field form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.categoryFieldsPanel.forms.createTitle}</h3>
        <form action={createFieldAction} className="mt-4 space-y-4">
          <input type="hidden" name="categoryId" value={categoryId} />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.columns.fieldKey}</span>
              <input
                name="fieldKey"
                required
                placeholder="e.g. car_brand"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.columns.fieldType}</span>
              <select name="fieldType" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring">
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.sortOrder}</span>
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={0}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.nameAr}</span>
              <input
                name="labelAr"
                required
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.nameEn}</span>
              <input
                name="labelEn"
                required
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.placeholderAr}</span>
              <input
                name="placeholderAr"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.placeholderEn}</span>
              <input
                name="placeholderEn"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="hidden" name="isRequired" value="false" />
              <input type="checkbox" name="isRequired" value="true" className="rounded" />
              {dictionary.admin.categoryFieldsPanel.forms.isRequired}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="hidden" name="filterable" value="false" />
              <input type="checkbox" name="filterable" value="true" className="rounded" />
              {dictionary.admin.categoryFieldsPanel.forms.filterable}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="hidden" name="detailVisible" value="false" />
              <input type="checkbox" name="detailVisible" value="true" defaultChecked className="rounded" />
              {dictionary.admin.categoryFieldsPanel.forms.detailVisible}
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.optionsJson}</span>
            <textarea
              name="optionsJson"
              rows={3}
              defaultValue="[]"
              placeholder='[{"value":"option1","labelAr":"خيار 1","labelEn":"Option 1"}]'
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
            />
            <p className="text-xs text-slate-400">{dictionary.admin.categoryFieldsPanel.forms.optionsJsonHint}</p>
          </label>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.categoryFieldsPanel.forms.createButton}
          </button>
        </form>
      </div>

      {/* Fields list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <span className="text-sm font-semibold text-slate-900">
            {dictionary.admin.categoryFieldsPanel.title} ({data.fields.length})
          </span>
        </div>
        {data.fields.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{dictionary.admin.categoryFieldsPanel.empty}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.fields.map((field) => (
              <details key={field.id} className="group">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <span className="flex-1 text-sm font-medium text-slate-900">{language === "ar" ? field.labelAr : field.labelEn}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{field.fieldKey}</span>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{field.fieldType}</span>
                  {field.isRequired ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                      {dictionary.admin.categoryFieldsPanel.forms.isRequired}
                    </span>
                  ) : null}
                  {field.filterable ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {dictionary.admin.categoryFieldsPanel.forms.filterable}
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-400">#{field.sortOrder}</span>
                </summary>
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                  <form action={updateFieldAction} className="space-y-4">
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="fieldId" value={field.id} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.columns.fieldKey}</span>
                        <input
                          name="fieldKey"
                          required
                          defaultValue={field.fieldKey}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.columns.fieldType}</span>
                        <select
                          name="fieldType"
                          defaultValue={field.fieldType}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                        >
                          {FIELD_TYPES.map((ft) => (
                            <option key={ft} value={ft}>{ft}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.sortOrder}</span>
                        <input
                          name="sortOrder"
                          type="number"
                          min={0}
                          defaultValue={field.sortOrder}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.nameAr}</span>
                        <input
                          name="labelAr"
                          required
                          defaultValue={field.labelAr}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoriesPanel.forms.nameEn}</span>
                        <input
                          name="labelEn"
                          required
                          defaultValue={field.labelEn}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.placeholderAr}</span>
                        <input
                          name="placeholderAr"
                          defaultValue={field.placeholderAr ?? ""}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.placeholderEn}</span>
                        <input
                          name="placeholderEn"
                          defaultValue={field.placeholderEn ?? ""}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input type="hidden" name="isRequired" value="false" />
                        <input type="checkbox" name="isRequired" value="true" defaultChecked={field.isRequired} className="rounded" />
                        {dictionary.admin.categoryFieldsPanel.forms.isRequired}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input type="hidden" name="filterable" value="false" />
                        <input type="checkbox" name="filterable" value="true" defaultChecked={field.filterable} className="rounded" />
                        {dictionary.admin.categoryFieldsPanel.forms.filterable}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input type="hidden" name="detailVisible" value="false" />
                        <input type="checkbox" name="detailVisible" value="true" defaultChecked={field.detailVisible} className="rounded" />
                        {dictionary.admin.categoryFieldsPanel.forms.detailVisible}
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">{dictionary.admin.categoryFieldsPanel.forms.optionsJson}</span>
                      <textarea
                        name="optionsJson"
                        rows={3}
                        defaultValue={field.optionsJson}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                      />
                    </label>
                    <div className="flex items-center gap-3">
                      <button type="submit" className="h-8 rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-dark">
                        {dictionary.admin.categoriesPanel.forms.saveButton}
                      </button>
                      <form action={deleteFieldAction}>
                        <input type="hidden" name="categoryId" value={categoryId} />
                        <input type="hidden" name="fieldId" value={field.id} />
                        <button type="submit" className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                          {dictionary.admin.categoriesPanel.forms.deleteButton}
                        </button>
                      </form>
                    </div>
                  </form>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
