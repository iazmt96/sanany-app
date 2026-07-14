"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import type { ListingsQuery, MarketplaceCategoryNode } from "@sanany/types";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { getWebCategoriesRepository } from "../lib/categories-repository";
import { getWebListingsRepository } from "../lib/listings-repository";

type CategoriesShellProps = {
  language: string;
};

const EXPERIENCE_ICONS: Record<MarketplaceCategoryNode["experienceKey"], string> = {
  general: "📦",
  vehicles: "🚗",
  real_estate: "🏠",
  electronics: "📱",
  livestock: "🐑",
  jobs: "💼",
  services: "🛠️"
};

function collectLeafCategories(node: MarketplaceCategoryNode): MarketplaceCategoryNode[] {
  if (node.children.length === 0) {
    return [node];
  }

  return node.children.flatMap(collectLeafCategories);
}

function CategoriesSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`category-skeleton-${index}`} className="h-48 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}

export function CategoriesShell({ language }: CategoriesShellProps) {
  const { t } = useTranslation();
  const repository = useMemo(() => getWebListingsRepository(), []);
  const categoriesRepository = useMemo(() => getWebCategoriesRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [categories, setCategories] = useState<MarketplaceCategoryNode[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const categoryTree = await categoriesRepository.listCategoryTree();
        const countEntries = await Promise.all(
          categoryTree.map(async (category) => {
            const leafCategories = collectLeafCategories(category);
            const totals = await Promise.all(
              leafCategories.map(async (leafCategory) => {
                const query: ListingsQuery = {
                  search: "",
                  status: "all",
                  sort: "newest",
                  page: 1,
                  pageSize: 1,
                  filters: {
                    category: leafCategory.slug
                  }
                };
                const result = await repository.list(query);
                return result.totalItems;
              })
            );

            return [category.slug, totals.reduce((sum, value) => sum + value, 0)] as const;
          })
        );

        if (!active) {
          return;
        }

        setCategories(categoryTree);
        setCounts(Object.fromEntries(countEntries));
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("marketplace.loadError"));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [categoriesRepository, repository, retryToken, t]);

  return (
    <section dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">{t("categories.pageTitle")}</h1>
        <p className="text-sm text-slate-600">{t("categories.pageSubtitle")}</p>
      </header>

      {error ? (
        <Card className="space-y-3 border-red-200">
          <p className="text-sm font-semibold text-red-600">{t("marketplace.loadError")}</p>
          <p className="text-xs text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((current) => current + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {t("common.retry")}
          </button>
        </Card>
      ) : null}

      {isLoading ? <CategoriesSkeleton /> : null}

      {!isLoading && !error ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={`category-${category.slug}`} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">{resolvedLanguage === "ar" ? category.nameAr : category.nameEn}</h2>
                  <p className="text-xs text-slate-500">{t("categories.explore")}</p>
                </div>
                <span className="text-3xl" aria-hidden>
                  {EXPERIENCE_ICONS[category.experienceKey]}
                </span>
              </div>

              <p className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {t("categories.countLabel", { count: counts[category.slug] ?? 0 })}
              </p>

              <ul className="space-y-2">
                {category.children.slice(0, 4).map((child) => {
                  const label = resolvedLanguage === "ar" ? child.nameAr : child.nameEn;
                  return (
                    <li key={`${category.slug}-${child.slug}`}>
                      <Link
                        href={`/${resolvedLanguage}/search?category=${encodeURIComponent(child.slug)}`}
                        className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-brand/40 hover:text-brand"
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <Link
                href={`/${resolvedLanguage}/search?category=${encodeURIComponent((category.children[0] ?? category).slug)}`}
                className="inline-flex text-sm font-semibold text-brand hover:underline"
              >
                {t("categories.openCategory")}
              </Link>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && categories.length === 0 ? (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{t("categories.emptyTitle")}</h2>
          <p className="text-sm text-slate-600">{t("categories.emptyDescription")}</p>
        </Card>
      ) : null}
    </section>
  );
}
