import assert from "node:assert/strict";
import test from "node:test";
import type { MarketplaceCategoryField } from "@sanany/types";
import {
  buildListingAttributesSummary,
  formatListingAttributeValue,
  normalizeListingAttributes,
  validateListingAttributes
} from "../src/listing-attributes.ts";

const fields: MarketplaceCategoryField[] = [
  {
    id: "f1",
    categoryId: "c1",
    fieldKey: "condition",
    fieldType: "select",
    labelAr: "الحالة",
    labelEn: "Condition",
    placeholderAr: null,
    placeholderEn: null,
    helperTextAr: null,
    helperTextEn: null,
    isRequired: true,
    sortOrder: 10,
    filterable: true,
    detailVisible: true,
    options: [
      { value: "new", labelAr: "جديد", labelEn: "New" },
      { value: "used", labelAr: "مستعمل", labelEn: "Used" }
    ]
  },
  {
    id: "f2",
    categoryId: "c1",
    fieldKey: "features",
    fieldType: "multiselect",
    labelAr: "المزايا",
    labelEn: "Features",
    placeholderAr: null,
    placeholderEn: null,
    helperTextAr: null,
    helperTextEn: null,
    isRequired: false,
    sortOrder: 20,
    filterable: true,
    detailVisible: true,
    options: [
      { value: "bluetooth", labelAr: "بلوتوث", labelEn: "Bluetooth" },
      { value: "camera", labelAr: "كاميرا", labelEn: "Camera" }
    ]
  },
  {
    id: "f3",
    categoryId: "c1",
    fieldKey: "price",
    fieldType: "number",
    labelAr: "السعر",
    labelEn: "Price",
    placeholderAr: null,
    placeholderEn: null,
    helperTextAr: null,
    helperTextEn: null,
    isRequired: false,
    sortOrder: 30,
    filterable: false,
    detailVisible: true,
    options: []
  }
];

test("normalizeListingAttributes keeps typed values", () => {
  const normalized = normalizeListingAttributes(fields, {
    condition: "used",
    features: ["bluetooth", "camera", "camera"],
    price: "12345"
  });

  assert.deepEqual(normalized, {
    condition: "used",
    features: ["bluetooth", "camera"],
    price: 12345
  });
});

test("validateListingAttributes rejects missing and invalid options", () => {
  assert.deepEqual(validateListingAttributes(fields, {}), ["condition"]);
  assert.deepEqual(validateListingAttributes(fields, { condition: "broken" }), ["condition"]);
  assert.deepEqual(validateListingAttributes(fields, { condition: "new", features: ["camera", "missing"] }), ["features"]);
});

test("format and summary use localized option labels", () => {
  assert.equal(formatListingAttributeValue(fields[0], "used", "ar"), "مستعمل");
  assert.equal(formatListingAttributeValue(fields[1], ["bluetooth", "camera"], "en"), "Bluetooth, Camera");

  const summary = buildListingAttributesSummary(fields, {
    condition: "new",
    features: ["camera"],
    price: 50000
  }, "ar");

  assert.deepEqual(summary, ["- الحالة: جديد", "- المزايا: كاميرا", "- السعر: 50000"]);
});
