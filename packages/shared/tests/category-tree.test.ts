import test from "node:test";
import assert from "node:assert/strict";
import type { MarketplaceCategoryNode } from "@sanany/types";
import { collectCategoryPreviewLeaves, collectLeafCategories, flattenCategoryTree, resolveCategorySearchTarget } from "../src/category-tree.ts";

function categoryNode(input: {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  children?: MarketplaceCategoryNode[];
}): MarketplaceCategoryNode {
  return {
    id: input.id,
    parentId: null,
    slug: input.slug,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    descriptionAr: null,
    descriptionEn: null,
    iconName: null,
    sortOrder: 0,
    isActive: true,
    offerType: null,
    experienceKey: "general",
    fields: [],
    children: input.children ?? []
  };
}

const nestedCategory = categoryNode({
  id: "root",
  slug: "vehicles",
  nameAr: "السيارات",
  nameEn: "Vehicles",
  children: [
    categoryNode({
      id: "sedan",
      slug: "sedan",
      nameAr: "سيدان",
      nameEn: "Sedan"
    }),
    categoryNode({
      id: "suv-parent",
      slug: "suv-parent",
      nameAr: "SUV",
      nameEn: "SUV",
      children: [
        categoryNode({
          id: "suv",
          slug: "suv",
          nameAr: "دفع رباعي",
          nameEn: "SUV"
        })
      ]
    })
  ]
});

test("collectLeafCategories returns only terminal nodes", () => {
  const leaves = collectLeafCategories(nestedCategory);
  assert.deepEqual(
    leaves.map((item) => item.slug),
    ["sedan", "suv"]
  );
});

test("resolveCategorySearchTarget picks the first leaf for nested categories", () => {
  const target = resolveCategorySearchTarget(nestedCategory);
  assert.equal(target.slug, "sedan");
});

test("collectCategoryPreviewLeaves respects provided limit", () => {
  const leaves = collectCategoryPreviewLeaves(nestedCategory, 1);
  assert.equal(leaves.length, 1);
  assert.equal(leaves[0]?.slug, "sedan");
});

test("flattenCategoryTree includes all hierarchy levels", () => {
  const nodes = flattenCategoryTree([nestedCategory]);
  assert.deepEqual(
    nodes.map((item) => item.slug),
    ["vehicles", "sedan", "suv-parent", "suv"]
  );
});
