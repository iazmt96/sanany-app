"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ListingsQuery } from "@sanany/types";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { getWebListingsRepository } from "../lib/listings-repository";

type CategoriesShellProps = {
  language: string;
};

type MainCategoryKey = "cars" | "realestate" | "electronics" | "services" | "furniture" | "jobs";

type MainCategoryConfig = {
  key: MainCategoryKey;
  icon: string;
  subcategoryTranslationKeys: string[];
};

const MAIN_CATEGORIES: readonly MainCategoryConfig[] = [
  { key: "cars", icon: "🚗", subcategoryTranslationKeys: ["marketplace.create.categories.carSale", "marketplace.create.categories.carPartsAndServices", "marketplace.create.categories.truckAndHeavy"] },
  { key: "realestate", icon: "🏠", subcategoryTranslationKeys: ["marketplace.create.categories.propertySale", "marketplace.create.categories.propertyRent", "marketplace.create.categories.warehouseRent"] },
  { key: "electronics", icon: "📱", subcategoryTranslationKeys: ["marketplace.create.categories.mobileSale", "marketplace.create.categories.laptopSale", "marketplace.create.categories.electronicPartsSale"] },
  { key: "services", icon: "🛠️", subcategoryTranslationKeys: ["marketplace.create.categories.cleaningService", "marketplace.create.categories.homeMaintenanceService", "marketplace.create.categories.deliveryService"] },
  { key: "furniture", icon: "🛋️", subcategoryTranslationKeys: ["marketplace.create.categories.furnitureSale", "marketplace.create.categories.homeAppliancesSale", "marketplace.create.categories.kidsSuppliesSale"] },
  { key: "jobs", icon: "💼", subcategoryTranslationKeys: ["marketplace.create.categories.studentServices", "marketplace.create.categories.requestTechService", "marketplace.create.categories.requestOther"] }
];

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
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [counts, setCounts] = useState<Record<MainCategoryKey, number>>({
    cars: 0,
    realestate: 0,
    electronics: 0,
    services: 0,
    furniture: 0,
    jobs: 0
  });

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const countEntries = await Promise.all(
          MAIN_CATEGORIES.map(async (category) => {
            const query: ListingsQuery = {
              search: t(`categories.items.${category.key}`),
              status: "all",
              sort: "newest",
              page: 1,
              pageSize: 1
            };
            const result = await repository.list(query);
            return [category.key, result.totalItems] as const;
          })
        );

        if (!active) {
          return;
        }

        setCounts((current) => {
          const next = { ...current };
          for (const [key, value] of countEntries) {
            next[key] = value;
          }
          return next;
        });
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
  }, [repository, retryToken, t]);

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
          {MAIN_CATEGORIES.map((category) => (
            <Card key={`category-${category.key}`} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">{t(`categories.items.${category.key}`)}</h2>
                  <p className="text-xs text-slate-500">{t("categories.explore")}</p>
                </div>
                <span className="text-3xl" aria-hidden>
                  {category.icon}
                </span>
              </div>

              <p className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {t("categories.countLabel", { count: counts[category.key] })}
              </p>

              <ul className="space-y-2">
                {category.subcategoryTranslationKeys.map((translationKey) => {
                  const label = t(translationKey);
                  return (
                    <li key={`${category.key}-${translationKey}`}>
                      <Link
                        href={`/${resolvedLanguage}/search?q=${encodeURIComponent(label)}`}
                        className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-brand/40 hover:text-brand"
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <Link href={`/${resolvedLanguage}/search?q=${encodeURIComponent(t(`categories.items.${category.key}`))}`} className="inline-flex text-sm font-semibold text-brand hover:underline">
                {t("categories.openCategory")}
              </Link>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && MAIN_CATEGORIES.length === 0 ? (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{t("categories.emptyTitle")}</h2>
          <p className="text-sm text-slate-600">{t("categories.emptyDescription")}</p>
        </Card>
      ) : null}
    </section>
  );
}

