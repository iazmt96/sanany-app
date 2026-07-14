import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ListingOfferType,
  MarketplaceCategory,
  MarketplaceCategoryField,
  MarketplaceCategoryFieldOption,
  MarketplaceCategoryNode
} from "@sanany/types";

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon_name: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  offer_type: ListingOfferType | null;
  experience_key: MarketplaceCategory["experienceKey"] | null;
};

type CategoryFieldRow = {
  id: string;
  category_id: string;
  field_key: string;
  field_type: MarketplaceCategoryField["fieldType"];
  label_ar: string;
  label_en: string;
  placeholder_ar: string | null;
  placeholder_en: string | null;
  helper_text_ar: string | null;
  helper_text_en: string | null;
  is_required: boolean | null;
  sort_order: number | null;
  filterable: boolean | null;
  detail_visible: boolean | null;
  options_json: unknown;
};

function mapFieldOptions(value: unknown): MarketplaceCategoryFieldOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option) => {
      if (!option || typeof option !== "object") {
        return null;
      }

      const payload = option as Record<string, unknown>;
      if (typeof payload.value !== "string" || typeof payload.labelAr !== "string" || typeof payload.labelEn !== "string") {
        return null;
      }

      return {
        value: payload.value,
        labelAr: payload.labelAr,
        labelEn: payload.labelEn
      };
    })
    .filter((option): option is MarketplaceCategoryFieldOption => Boolean(option));
}

function mapCategory(row: CategoryRow): MarketplaceCategory {
  return {
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    iconName: row.icon_name,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    offerType: row.offer_type ?? null,
    experienceKey: row.experience_key ?? "general"
  };
}

function mapField(row: CategoryFieldRow): MarketplaceCategoryField {
  return {
    id: row.id,
    categoryId: row.category_id,
    fieldKey: row.field_key,
    fieldType: row.field_type,
    labelAr: row.label_ar,
    labelEn: row.label_en,
    placeholderAr: row.placeholder_ar,
    placeholderEn: row.placeholder_en,
    helperTextAr: row.helper_text_ar,
    helperTextEn: row.helper_text_en,
    isRequired: row.is_required ?? false,
    sortOrder: row.sort_order ?? 0,
    filterable: row.filterable ?? false,
    detailVisible: row.detail_visible ?? true,
    options: mapFieldOptions(row.options_json)
  };
}

function buildCategoryTree(categories: MarketplaceCategory[], fields: MarketplaceCategoryField[]): MarketplaceCategoryNode[] {
  const nodeMap = new Map<string, MarketplaceCategoryNode>();
  for (const category of categories) {
    nodeMap.set(category.id, {
      ...category,
      fields: [],
      children: []
    });
  }

  for (const field of fields) {
    const node = nodeMap.get(field.categoryId);
    if (node) {
      node.fields.push(field);
    }
  }

  const roots: MarketplaceCategoryNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  const sortNodes = (nodes: MarketplaceCategoryNode[]) => {
    nodes.sort((left, right) => left.sortOrder - right.sortOrder || left.nameAr.localeCompare(right.nameAr, "ar"));
    for (const node of nodes) {
      node.fields.sort((left, right) => left.sortOrder - right.sortOrder || left.labelAr.localeCompare(right.labelAr, "ar"));
      sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

export type CategoriesRepository = {
  listCategoryTree(input?: { offerType?: ListingOfferType | null; includeInactive?: boolean }): Promise<MarketplaceCategoryNode[]>;
  listCategories(input?: { offerType?: ListingOfferType | null; parentId?: string | null; includeInactive?: boolean }): Promise<MarketplaceCategory[]>;
  getCategoryBySlug(slug: string): Promise<MarketplaceCategoryNode | null>;
};

export function createCategoriesRepository(client: SupabaseClient): CategoriesRepository {
  const selectCategories = async (input?: { offerType?: ListingOfferType | null; parentId?: string | null; includeInactive?: boolean }) => {
    let query = client
      .from("marketplace_categories")
      .select("id,parent_id,slug,name_ar,name_en,description_ar,description_en,icon_name,sort_order,is_active,offer_type,experience_key")
      .order("sort_order", { ascending: true })
      .order("name_ar", { ascending: true });

    if (!input?.includeInactive) {
      query = query.eq("is_active", true);
    }

    if (input?.offerType) {
      query = query.or(`offer_type.eq.${input.offerType},offer_type.is.null`);
    }

    if (input?.parentId !== undefined) {
      if (input.parentId === null) {
        query = query.is("parent_id", null);
      } else {
        query = query.eq("parent_id", input.parentId);
      }
    }

    const result = await query;
    if (result.error) {
      throw result.error;
    }

    return (result.data as CategoryRow[] | null) ?? [];
  };

  return {
    async listCategoryTree(input) {
      const categories = (await selectCategories(input)).map(mapCategory);
      if (categories.length === 0) {
        return [];
      }

      const categoryIds = categories.map((category) => category.id);
      const fieldsResult = await client
        .from("marketplace_category_fields")
        .select("id,category_id,field_key,field_type,label_ar,label_en,placeholder_ar,placeholder_en,helper_text_ar,helper_text_en,is_required,sort_order,filterable,detail_visible,options_json")
        .in("category_id", categoryIds)
        .order("sort_order", { ascending: true })
        .order("label_ar", { ascending: true });

      if (fieldsResult.error) {
        throw fieldsResult.error;
      }

      return buildCategoryTree(categories, ((fieldsResult.data as CategoryFieldRow[] | null) ?? []).map(mapField));
    },
    async listCategories(input) {
      return (await selectCategories(input)).map(mapCategory);
    },
    async getCategoryBySlug(slug) {
      const categoryResult = await client
        .from("marketplace_categories")
        .select("id,parent_id,slug,name_ar,name_en,description_ar,description_en,icon_name,sort_order,is_active,offer_type,experience_key")
        .eq("slug", slug)
        .maybeSingle();

      if (categoryResult.error) {
        throw categoryResult.error;
      }

      const categoryRow = categoryResult.data as CategoryRow | null;
      if (!categoryRow) {
        return null;
      }

      const categories = await selectCategories({
        includeInactive: true
      });
      const relatedRows = categories.filter((row) => row.id === categoryRow.id || row.parent_id === categoryRow.id || row.id === categoryRow.parent_id);
      const mappedCategories = Array.from(
        new Map(relatedRows.concat([categoryRow]).map((row) => [row.id, mapCategory(row)])).values()
      );

      const fieldsResult = await client
        .from("marketplace_category_fields")
        .select("id,category_id,field_key,field_type,label_ar,label_en,placeholder_ar,placeholder_en,helper_text_ar,helper_text_en,is_required,sort_order,filterable,detail_visible,options_json")
        .eq("category_id", categoryRow.id)
        .order("sort_order", { ascending: true })
        .order("label_ar", { ascending: true });

      if (fieldsResult.error) {
        throw fieldsResult.error;
      }

      const tree = buildCategoryTree(mappedCategories, ((fieldsResult.data as CategoryFieldRow[] | null) ?? []).map(mapField));
      const stack = [...tree];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
          continue;
        }
        if (current.slug === slug) {
          return current;
        }
        stack.push(...current.children);
      }

      return null;
    }
  };
}
