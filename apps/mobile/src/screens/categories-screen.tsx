import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { resolveCategorySearchTarget } from "@sanany/shared";
import type { MarketplaceCategoryNode } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { MobileSectionHeader } from "../components/mobile-section-header";
import { getMobileCategoriesRepository } from "../lib/categories-repository";

type CategoriesScreenProps = {
  direction: Direction;
  onPickCategory(query: string): void;
};

const EXPERIENCE_EMOJI: Record<MarketplaceCategoryNode["experienceKey"], string> = {
  general: "📦",
  vehicles: "🚗",
  real_estate: "🏠",
  electronics: "📱",
  livestock: "🐑",
  jobs: "💼",
  services: "🛠️"
};

export function CategoriesScreen({ direction, onPickCategory }: CategoriesScreenProps) {
  const { t } = useTranslation();
  const categoriesRepository = useMemo(() => getMobileCategoriesRepository(), []);
  const textAlign = direction === "rtl" ? "right" : "left";
  const isRtl = direction === "rtl";
  const [categories, setCategories] = useState<MarketplaceCategoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const tree = await categoriesRepository.listCategoryTree();
        if (!active) {
          return;
        }
        setCategories(tree);
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
  }, [categoriesRepository, retryToken, t]);

  return (
    <View style={styles.container}>
      <MobileSectionHeader direction={direction} title={t("categories.pageTitle")} subtitle={t("categories.pageSubtitle")} />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { textAlign }]}>{t("marketplace.loadError")}</Text>
          <Text style={[styles.errorHint, { textAlign }]}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => setRetryToken((current) => current + 1)}>
            <Text style={styles.retryLabel}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <View style={[styles.grid, isRtl ? styles.gridRtl : undefined]}>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={`category-skeleton-${index}`} style={styles.skeletonCard} />
          ))}
        </View>
      ) : null}

      {!isLoading && !error && categories.length > 0 ? (
        <View style={[styles.grid, isRtl ? styles.gridRtl : undefined]}>
          {categories.map((category) => {
            const searchTarget = resolveCategorySearchTarget(category);
            const title = direction === "rtl" ? category.nameAr : category.nameEn;
            const targetLabel = direction === "rtl" ? searchTarget.nameAr : searchTarget.nameEn;

            return (
              <Pressable key={category.id} style={styles.card} onPress={() => onPickCategory(targetLabel)}>
                <Text style={styles.emoji}>{EXPERIENCE_EMOJI[category.experienceKey]}</Text>
                <Text style={[styles.cardTitle, { textAlign }]}>{title}</Text>
                <Text style={[styles.cardHint, { textAlign }]}>{t("categories.explore")}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!isLoading && !error && categories.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyTitle, { textAlign }]}>{t("categories.emptyTitle")}</Text>
          <Text style={[styles.emptyHint, { textAlign }]}>{t("categories.emptyDescription")}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  grid: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  gridRtl: {
    flexDirection: "row-reverse"
  },
  card: {
    width: "48%",
    minHeight: 132,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  skeletonCard: {
    width: "48%",
    minHeight: 132,
    borderRadius: 22,
    backgroundColor: "#e2e8f0"
  },
  emoji: {
    fontSize: 28,
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  cardHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  },
  errorBox: {
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: "#fef2f2",
    padding: 12
  },
  errorText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#b91c1c"
  },
  errorHint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#7f1d1d"
  },
  retryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  retryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c"
  },
  emptyBox: {
    marginTop: 4,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 14
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a"
  },
  emptyHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  }
});
