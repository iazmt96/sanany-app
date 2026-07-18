import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { ListingOfferType } from "@sanany/types";
import { createClient } from "../../utils/supabase/server";

export type AdminCategoryOverview = {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  listingCount: number;
  subcategoryCount: number;
};

export type AdminCategoryRow = {
  id: string;
  parentId: string | null;
  slug: string;
  labelAr: string;
  labelEn: string;
  mainCategoryLabelAr: string;
  mainCategoryLabelEn: string;
  listingCount: number;
  fieldsCount: number;
  offerType: ListingOfferType | null;
  isActive: boolean;
  sortOrder: number;
};

export type AdminCategoriesPageData = {
  overview: AdminCategoryOverview[];
  rows: AdminCategoryRow[];
  rootOptions: Array<{ id: string; slug: string; labelAr: string; labelEn: string }>;
  totalItems: number;
  totalPages: number;
  totalListings: number;
  page: number;
  pageSize: number;
  errorCode: string | null;
};

export type AdminCategoriesFilters = {
  group?: string | null;
  page?: string | null;
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  name_ar: string;
  name_en: string;
  offer_type: ListingOfferType | null;
  is_active: boolean | null;
  sort_order: number | null;
};

type CategoryFieldCountRow = {
  category_id: string;
};

type AdminCategoryMutationInput = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  offerType: ListingOfferType | null;
  sortOrder: number;
  isActive?: boolean;
  parentId?: string | null;
};

type CreateAdminCategoryInput = {
  parentId: string | null;
  slug: string;
  nameAr: string;
  nameEn: string;
  offerType: ListingOfferType | null;
  sortOrder: number;
};

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function normalizeSortOrder(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeOfferType(value: string | null | undefined): ListingOfferType | null {
  if (value === "sell" || value === "rent" || value === "service" || value === "request") {
    return value;
  }
  return null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

async function countListingsForCategory(adminClient: ReturnType<typeof requireServiceRoleClient>, categorySlug: string): Promise<number> {
  const { count, error } = await adminClient.from("listings").select("id", { count: "exact", head: true }).eq("category_slug", categorySlug);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function getAdminCategoriesPageData(filters: AdminCategoriesFilters): Promise<AdminCategoriesPageData> {
  const supabase = await createClient();
  const page = normalizePage(filters.page);
  const pageSize = 12;

  const [categoriesResult, fieldsResult] = await Promise.all([
    supabase
      .from("marketplace_categories")
      .select("id,parent_id,slug,name_ar,name_en,offer_type,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .order("name_ar", { ascending: true }),
    supabase.from("marketplace_category_fields").select("category_id")
  ]);

  if (categoriesResult.error || fieldsResult.error) {
    return {
      overview: [],
      rows: [],
      rootOptions: [],
      totalItems: 0,
      totalPages: 1,
      totalListings: 0,
      page,
      pageSize,
      errorCode: categoriesResult.error?.code ?? fieldsResult.error?.code ?? "unknown"
    };
  }

  const categories = (categoriesResult.data as CategoryRow[] | null) ?? [];
  const fieldRows = (fieldsResult.data as CategoryFieldCountRow[] | null) ?? [];
  const fieldCounts = fieldRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.category_id] = (accumulator[row.category_id] ?? 0) + 1;
    return accumulator;
  }, {});

  const rootCategories = categories.filter((category) => category.parent_id === null);
  const childCategories = categories.filter((category) => category.parent_id !== null);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const rootFilter = rootCategories.find((category) => category.slug === filters.group) ?? null;
  const adminClient = requireServiceRoleClient();

  const rowsWithCounts = await Promise.all(
    childCategories.map(async (category) => {
      const rootCategory = category.parent_id ? categoryMap.get(category.parent_id) : null;
      const listingCount = await countListingsForCategory(adminClient, category.slug);
      return {
        category,
        rootCategory,
        listingCount,
        fieldsCount: fieldCounts[category.id] ?? 0
      };
    })
  );

  const overview = rootCategories.map((rootCategory) => {
    const groupRows = rowsWithCounts.filter((row) => row.rootCategory?.id === rootCategory.id);
    return {
      id: rootCategory.id,
      slug: rootCategory.slug,
      labelAr: rootCategory.name_ar,
      labelEn: rootCategory.name_en,
      listingCount: groupRows.reduce((sum, row) => sum + row.listingCount, 0),
      subcategoryCount: groupRows.length
    };
  });

  const filteredRows = rowsWithCounts
    .filter((row) => (rootFilter ? row.rootCategory?.id === rootFilter.id : true))
    .sort(
      (left, right) =>
        right.listingCount - left.listingCount ||
        (left.category.sort_order ?? 0) - (right.category.sort_order ?? 0) ||
        left.category.name_ar.localeCompare(right.category.name_ar, "ar")
    )
    .map(({ category, rootCategory, listingCount, fieldsCount }) => ({
      id: category.id,
      parentId: category.parent_id,
      slug: category.slug,
      labelAr: category.name_ar,
      labelEn: category.name_en,
      mainCategoryLabelAr: rootCategory?.name_ar ?? category.name_ar,
      mainCategoryLabelEn: rootCategory?.name_en ?? category.name_en,
      listingCount,
      fieldsCount,
      offerType: category.offer_type,
      isActive: category.is_active ?? true,
      sortOrder: category.sort_order ?? 0
    }));

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize;

  return {
    overview,
    rows: filteredRows.slice(from, to),
    rootOptions: rootCategories.map((root) => ({
      id: root.id,
      slug: root.slug,
      labelAr: root.name_ar,
      labelEn: root.name_en
    })),
    totalItems,
    totalPages,
    totalListings: overview.reduce((sum, item) => sum + item.listingCount, 0),
    page: safePage,
    pageSize,
    errorCode: null
  };
}

export async function createAdminCategory(input: CreateAdminCategoryInput): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const slug = normalizeSlug(requireText(input.slug, "slug"));
  const nameAr = requireText(input.nameAr, "nameAr");
  const nameEn = requireText(input.nameEn, "nameEn");
  if (!slug) {
    throw new Error("Invalid slug value.");
  }

  const payload = {
    parent_id: input.parentId,
    slug,
    name_ar: nameAr,
    name_en: nameEn,
    offer_type: input.offerType,
    sort_order: normalizeSortOrder(input.sortOrder),
    is_active: true
  };
  const { error } = await adminClient.from("marketplace_categories").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAdminCategory(input: AdminCategoryMutationInput): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const slug = normalizeSlug(requireText(input.slug, "slug"));
  const nameAr = requireText(input.nameAr, "nameAr");
  const nameEn = requireText(input.nameEn, "nameEn");

  const payload = {
    slug,
    name_ar: nameAr,
    name_en: nameEn,
    offer_type: input.offerType,
    sort_order: normalizeSortOrder(input.sortOrder),
    is_active: input.isActive ?? true,
    parent_id: input.parentId === undefined ? undefined : input.parentId
  };
  const { error } = await adminClient.from("marketplace_categories").update(payload).eq("id", input.id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAdminCategory(categoryId: string): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const categoryResult = await adminClient.from("marketplace_categories").select("id,slug").eq("id", categoryId).maybeSingle();
  if (categoryResult.error) {
    throw new Error(categoryResult.error.message);
  }
  if (!categoryResult.data) {
    throw new Error("Category not found.");
  }

  const childResult = await adminClient.from("marketplace_categories").select("id", { count: "exact", head: true }).eq("parent_id", categoryId);
  if (childResult.error) {
    throw new Error(childResult.error.message);
  }
  if ((childResult.count ?? 0) > 0) {
    throw new Error("Cannot delete category with subcategories.");
  }

  const listingsCount = await countListingsForCategory(adminClient, categoryResult.data.slug);
  if (listingsCount > 0) {
    throw new Error("Cannot delete category with active listings.");
  }

  const { error } = await adminClient.from("marketplace_categories").delete().eq("id", categoryId);
  if (error) {
    throw new Error(error.message);
  }
}

export function parseOfferTypeFormValue(value: FormDataEntryValue | null): ListingOfferType | null {
  if (typeof value !== "string") {
    return null;
  }
  return normalizeOfferType(value);
}

// ---------------------------------------------------------------------------
// Category fields management
// ---------------------------------------------------------------------------

export type AdminCategoryFieldRow = {
  id: string;
  categoryId: string;
  fieldKey: string;
  fieldType: string;
  labelAr: string;
  labelEn: string;
  placeholderAr: string | null;
  placeholderEn: string | null;
  isRequired: boolean;
  filterable: boolean;
  detailVisible: boolean;
  sortOrder: number;
  optionsJson: string;
};

export type AdminCategoryDetailData = {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  fields: AdminCategoryFieldRow[];
  errorCode: string | null;
};

type FieldRow = {
  id: string;
  category_id: string;
  field_key: string;
  field_type: string;
  label_ar: string;
  label_en: string;
  placeholder_ar: string | null;
  placeholder_en: string | null;
  is_required: boolean | null;
  filterable: boolean | null;
  detail_visible: boolean | null;
  sort_order: number | null;
  options_json: unknown;
};

function mapFieldRow(row: FieldRow): AdminCategoryFieldRow {
  return {
    id: row.id,
    categoryId: row.category_id,
    fieldKey: row.field_key,
    fieldType: row.field_type,
    labelAr: row.label_ar,
    labelEn: row.label_en,
    placeholderAr: row.placeholder_ar,
    placeholderEn: row.placeholder_en,
    isRequired: row.is_required ?? false,
    filterable: row.filterable ?? false,
    detailVisible: row.detail_visible ?? true,
    sortOrder: row.sort_order ?? 0,
    optionsJson: Array.isArray(row.options_json) ? JSON.stringify(row.options_json, null, 2) : "[]"
  };
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "true";
}

function normalizeFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeFieldType(value: string | null | undefined): string {
  const VALID = ["text", "textarea", "number", "select", "multiselect", "boolean"] as const;
  if (VALID.includes(value as (typeof VALID)[number])) {
    return value as string;
  }
  return "text";
}

function parseOptionsJson(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function getAdminCategoryDetail(categoryId: string): Promise<AdminCategoryDetailData> {
  const adminClient = requireServiceRoleClient();

  const [categoryResult, fieldsResult] = await Promise.all([
    adminClient.from("marketplace_categories").select("id,slug,name_ar,name_en").eq("id", categoryId).maybeSingle(),
    adminClient
      .from("marketplace_category_fields")
      .select("id,category_id,field_key,field_type,label_ar,label_en,placeholder_ar,placeholder_en,is_required,filterable,detail_visible,sort_order,options_json")
      .eq("category_id", categoryId)
      .order("sort_order", { ascending: true })
  ]);

  if (categoryResult.error) {
    return { id: categoryId, slug: "", labelAr: "", labelEn: "", fields: [], errorCode: categoryResult.error.code };
  }
  if (!categoryResult.data) {
    return { id: categoryId, slug: "", labelAr: "", labelEn: "", fields: [], errorCode: "not_found" };
  }

  const category = categoryResult.data as { id: string; slug: string; name_ar: string; name_en: string };
  const fields = ((fieldsResult.data as FieldRow[] | null) ?? []).map(mapFieldRow);

  return {
    id: category.id,
    slug: category.slug,
    labelAr: category.name_ar,
    labelEn: category.name_en,
    fields,
    errorCode: fieldsResult.error?.code ?? null
  };
}

export async function createAdminCategoryField(input: {
  categoryId: string;
  fieldKey: string;
  fieldType: string;
  labelAr: string;
  labelEn: string;
  placeholderAr: string | null;
  placeholderEn: string | null;
  isRequired: boolean;
  filterable: boolean;
  detailVisible: boolean;
  sortOrder: number;
  optionsJson: string;
}): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const fieldKey = normalizeFieldKey(requireText(input.fieldKey, "fieldKey"));
  if (!fieldKey) {
    throw new Error("Invalid field key.");
  }
  const labelAr = requireText(input.labelAr, "labelAr");
  const labelEn = requireText(input.labelEn, "labelEn");

  const { error } = await adminClient.from("marketplace_category_fields").insert({
    category_id: input.categoryId,
    field_key: fieldKey,
    field_type: normalizeFieldType(input.fieldType),
    label_ar: labelAr,
    label_en: labelEn,
    placeholder_ar: input.placeholderAr?.trim() || null,
    placeholder_en: input.placeholderEn?.trim() || null,
    is_required: input.isRequired,
    filterable: input.filterable,
    detail_visible: input.detailVisible,
    sort_order: normalizeSortOrder(input.sortOrder),
    options_json: parseOptionsJson(input.optionsJson)
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAdminCategoryField(input: {
  fieldId: string;
  fieldKey: string;
  fieldType: string;
  labelAr: string;
  labelEn: string;
  placeholderAr: string | null;
  placeholderEn: string | null;
  isRequired: boolean;
  filterable: boolean;
  detailVisible: boolean;
  sortOrder: number;
  optionsJson: string;
}): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const fieldKey = normalizeFieldKey(requireText(input.fieldKey, "fieldKey"));
  const labelAr = requireText(input.labelAr, "labelAr");
  const labelEn = requireText(input.labelEn, "labelEn");

  const { error } = await adminClient.from("marketplace_category_fields").update({
    field_key: fieldKey,
    field_type: normalizeFieldType(input.fieldType),
    label_ar: labelAr,
    label_en: labelEn,
    placeholder_ar: input.placeholderAr?.trim() || null,
    placeholder_en: input.placeholderEn?.trim() || null,
    is_required: input.isRequired,
    filterable: input.filterable,
    detail_visible: input.detailVisible,
    sort_order: normalizeSortOrder(input.sortOrder),
    options_json: parseOptionsJson(input.optionsJson)
  }).eq("id", input.fieldId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAdminCategoryField(fieldId: string): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const { error } = await adminClient.from("marketplace_category_fields").delete().eq("id", fieldId);
  if (error) {
    throw new Error(error.message);
  }
}

export { parseBoolean };
