import { CATEGORY_KEYWORDS, escapeListingsSearchTerm } from "@sanany/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingCategory } from "@sanany/types";
import { createClient } from "../../utils/supabase/server";

const MAIN_CATEGORY_KEYS = ["cars", "realestate", "electronics", "services", "furniture", "jobs"] as const;
export type AdminMainCategoryKey = (typeof MAIN_CATEGORY_KEYS)[number];

type AdminCategoryGroup = {
  key: AdminMainCategoryKey;
  subcategories: readonly ListingCategory[];
};

const ADMIN_CATEGORY_GROUPS: readonly AdminCategoryGroup[] = [
  {
    key: "cars",
    subcategories: ["carSale", "carPartsAndServices", "truckAndHeavy", "bikeSale", "carRent"]
  },
  {
    key: "realestate",
    subcategories: ["propertySale", "propertyRent", "chaletRent", "warehouseRent"]
  },
  {
    key: "electronics",
    subcategories: ["deviceSale", "mobileSale", "laptopSale", "electronicPartsSale", "cameraGearRent"]
  },
  {
    key: "services",
    subcategories: [
      "serviceOffer",
      "cleaningService",
      "homeMaintenanceService",
      "electricalPlumbingService",
      "movingService",
      "designTechService",
      "photoVideoService",
      "deliveryService",
      "womenServices",
      "studentServices",
      "serviceOther",
      "requestHomeService",
      "requestTechService",
      "requestUrgentMaintenance"
    ]
  },
  {
    key: "furniture",
    subcategories: [
      "furnitureSale",
      "homeAppliancesSale",
      "toolsEquipmentSale",
      "clothingSale",
      "kidsSuppliesSale",
      "livestockSale",
      "generalGoods",
      "saleOther",
      "eventEquipmentRent",
      "constructionToolsRent",
      "rentOther"
    ]
  },
  {
    key: "jobs",
    subcategories: ["requestGoods", "requestPurchase", "requestRent", "requestOther"]
  }
] as const;

export type AdminCategoryOverview = {
  key: AdminMainCategoryKey;
  listingCount: number;
  subcategoryCount: number;
};

export type AdminCategoryRow = {
  mainCategory: AdminMainCategoryKey;
  category: ListingCategory;
  listingCount: number;
  keywords: string[];
};

export type AdminCategoriesPageData = {
  overview: AdminCategoryOverview[];
  rows: AdminCategoryRow[];
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

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseGroup(value: string | null | undefined): AdminMainCategoryKey | null {
  return MAIN_CATEGORY_KEYS.find((item) => item === value) ?? null;
}

async function countListingsForCategory(supabase: SupabaseClient, category: ListingCategory): Promise<{ count: number; errorCode: string | null }> {
  const keywords = CATEGORY_KEYWORDS[category];
  const orClauses = keywords.flatMap((keyword) => {
    const escaped = escapeListingsSearchTerm(keyword);
    return [`title.ilike.%${escaped}%`, `description.ilike.%${escaped}%`];
  });

  const { count, error } = await supabase.from("listings").select("id", { count: "exact", head: true }).or(orClauses.join(","));
  if (error) {
    return { count: 0, errorCode: error.code ?? "unknown" };
  }

  return { count: count ?? 0, errorCode: null };
}

export async function getAdminCategoriesPageData(filters: AdminCategoriesFilters): Promise<AdminCategoriesPageData> {
  const supabase = await createClient();
  const page = normalizePage(filters.page);
  const pageSize = 12;
  const groupFilter = parseGroup(filters.group);

  const rowsWithCounts = await Promise.all(
    ADMIN_CATEGORY_GROUPS.flatMap((group) =>
      group.subcategories.map(async (category) => {
        const result = await countListingsForCategory(supabase, category);
        return {
          mainCategory: group.key,
          category,
          listingCount: result.count,
          keywords: CATEGORY_KEYWORDS[category].slice(0, 3),
          errorCode: result.errorCode
        };
      })
    )
  );

  const errorCode = rowsWithCounts.find((row) => row.errorCode)?.errorCode ?? null;
  if (errorCode) {
    return {
      overview: ADMIN_CATEGORY_GROUPS.map((group) => ({
        key: group.key,
        listingCount: 0,
        subcategoryCount: group.subcategories.length
      })),
      rows: [],
      totalItems: 0,
      totalPages: 1,
      totalListings: 0,
      page,
      pageSize,
      errorCode
    };
  }

  const overview = ADMIN_CATEGORY_GROUPS.map((group) => {
    const groupRows = rowsWithCounts.filter((row) => row.mainCategory === group.key);
    return {
      key: group.key,
      listingCount: groupRows.reduce((sum, row) => sum + row.listingCount, 0),
      subcategoryCount: group.subcategories.length
    };
  });

  const filteredRows = rowsWithCounts
    .filter((row) => (groupFilter ? row.mainCategory === groupFilter : true))
    .sort((left, right) => right.listingCount - left.listingCount || left.category.localeCompare(right.category));

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize;

  return {
    overview,
    rows: filteredRows.slice(from, to).map(({ errorCode: _errorCode, ...row }) => row),
    totalItems,
    totalPages,
    totalListings: overview.reduce((sum, item) => sum + item.listingCount, 0),
    page: safePage,
    pageSize,
    errorCode: null
  };
}
