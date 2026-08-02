import type {
  ListingAttributeValue,
  ListingAttributes,
  MarketplaceCategoryField,
  MarketplaceCategoryFieldOption
} from "@sanany/types";

type FieldLanguage = "ar" | "en";

function isKnownOption(option: MarketplaceCategoryFieldOption, value: string): boolean {
  return option.value === value;
}

export function getCategoryFieldLabel(field: MarketplaceCategoryField, language: FieldLanguage): string {
  return language === "ar" ? field.labelAr : field.labelEn;
}

export function getCategoryFieldPlaceholder(field: MarketplaceCategoryField, language: FieldLanguage): string | null {
  return language === "ar" ? field.placeholderAr : field.placeholderEn;
}

export function getCategoryFieldHelperText(field: MarketplaceCategoryField, language: FieldLanguage): string | null {
  return language === "ar" ? field.helperTextAr : field.helperTextEn;
}

export function normalizeCategoryFieldValue(field: MarketplaceCategoryField, value: unknown): ListingAttributeValue {
  if (value === undefined || value === null) {
    return field.fieldType === "multiselect" ? [] : null;
  }

  if (field.fieldType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    return null;
  }

  if (field.fieldType === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : normalized;
    }
    return null;
  }

  if (field.fieldType === "multiselect") {
    const rawValues = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return rawValues
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0)
      .filter((item, index, items) => items.indexOf(item) === index);
  }

  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return null;
  }
  return normalized;
}

export function normalizeListingAttributes(fields: MarketplaceCategoryField[], values: Record<string, unknown>): ListingAttributes {
  return fields.reduce<ListingAttributes>((attributes, field) => {
    const normalized = normalizeCategoryFieldValue(field, values[field.fieldKey]);
    if (normalized === null) {
      return attributes;
    }
    if (Array.isArray(normalized) && normalized.length === 0) {
      return attributes;
    }
    attributes[field.fieldKey] = normalized;
    return attributes;
  }, {});
}

export function validateListingAttributes(fields: MarketplaceCategoryField[], values: Record<string, unknown>): string[] {
  const missingKeys: string[] = [];

  for (const field of fields) {
    const normalized = normalizeCategoryFieldValue(field, values[field.fieldKey]);
    if (
      field.isRequired &&
      (normalized === null ||
        (Array.isArray(normalized) && normalized.length === 0) ||
        (typeof normalized === "string" && normalized.trim().length === 0))
    ) {
      missingKeys.push(field.fieldKey);
      continue;
    }

    if (field.options.length === 0) {
      continue;
    }

    if (field.fieldType === "select" && typeof normalized === "string") {
      if (!field.options.some((option) => isKnownOption(option, normalized))) {
        missingKeys.push(field.fieldKey);
      }
      continue;
    }

    if (field.fieldType === "multiselect" && Array.isArray(normalized)) {
      const invalidValues = normalized.filter((item) => !field.options.some((option) => isKnownOption(option, item)));
      if (invalidValues.length > 0) {
        missingKeys.push(field.fieldKey);
      }
    }
  }

  return missingKeys;
}

function resolveOptionLabel(field: MarketplaceCategoryField, value: string, language: FieldLanguage): string {
  const match = field.options.find((option) => option.value === value);
  if (!match) {
    return value;
  }
  return language === "ar" ? match.labelAr : match.labelEn;
}

export function formatListingAttributeValue(field: MarketplaceCategoryField, value: ListingAttributeValue, language: FieldLanguage): string {
  if (value === null) {
    return "";
  }

  if (typeof value === "boolean") {
    return language === "ar" ? (value ? "نعم" : "لا") : value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveOptionLabel(field, item, language)).join(language === "ar" ? "، " : ", ");
  }

  if (field.fieldType === "select") {
    return resolveOptionLabel(field, value, language);
  }

  return value;
}

export function buildListingAttributesSummary(fields: MarketplaceCategoryField[], values: Record<string, unknown>, language: FieldLanguage): string[] {
  const attributes = normalizeListingAttributes(fields, values);
  return fields.reduce<string[]>((rows, field) => {
    const value = attributes[field.fieldKey] ?? null;
    if (value === null || (Array.isArray(value) && value.length === 0)) {
      return rows;
    }
    rows.push(`- ${getCategoryFieldLabel(field, language)}: ${formatListingAttributeValue(field, value, language)}`);
    return rows;
  }, []);
}
