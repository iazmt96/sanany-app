import type { MarketplaceCategoryNode } from "@sanany/types";

function flattenCategoryNode(node: MarketplaceCategoryNode, output: MarketplaceCategoryNode[]): void {
  output.push(node);
  for (const child of node.children) {
    flattenCategoryNode(child, output);
  }
}

export function flattenCategoryTree(tree: MarketplaceCategoryNode[]): MarketplaceCategoryNode[] {
  const output: MarketplaceCategoryNode[] = [];
  for (const node of tree) {
    flattenCategoryNode(node, output);
  }
  return output;
}

export function collectLeafCategories(node: MarketplaceCategoryNode): MarketplaceCategoryNode[] {
  if (node.children.length === 0) {
    return [node];
  }

  return node.children.flatMap((child) => collectLeafCategories(child));
}

export function resolveCategorySearchTarget(node: MarketplaceCategoryNode): MarketplaceCategoryNode {
  return collectLeafCategories(node)[0] ?? node;
}

export function collectCategoryPreviewLeaves(node: MarketplaceCategoryNode, limit = 4): MarketplaceCategoryNode[] {
  return collectLeafCategories(node).slice(0, Math.max(1, limit));
}
