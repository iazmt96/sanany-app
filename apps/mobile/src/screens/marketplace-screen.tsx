import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getPrimaryListingImageUrl } from "@sanany/shared";
import type { ListingFilterStatus, ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";
import { useAuth } from "../auth/auth-context";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { type Direction } from "@sanany/utils";
import { MobileEmptyState } from "../components/mobile-empty-state";
import { MobileIcon } from "../components/mobile-icons";
import { MobileListingTile } from "../components/mobile-listing-tile";
import { MobileSectionHeader } from "../components/mobile-section-header";

type MarketplaceScreenProps = {
  direction: Direction;
  onOpenListing(listing: MarketplaceListing): void;
};

type QuickPreset = "all" | "available" | "reserved" | "withImages" | "newest" | "priceLow";

export function MarketplaceScreen({ direction, onOpenListing }: MarketplaceScreenProps) {
  const { t } = useTranslation();
  const { snapshot, signOut } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const [search, setSearch] = useState("");
  const [quickPreset, setQuickPreset] = useState<QuickPreset>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: 8,
    totalPages: 1
  });
  const textAlign = direction === "rtl" ? "right" : "left";
  const isRtl = direction === "rtl";
  const activeStatus: ListingFilterStatus = quickPreset === "available" ? "available" : quickPreset === "reserved" ? "reserved" : "all";
  const activeSort: ListingsQuery["sort"] = quickPreset === "priceLow" ? "priceLow" : "newest";
  const withImagesOnly = quickPreset === "withImages";

  useEffect(() => {
    let active = true;
    const query: ListingsQuery = {
      search,
      status: activeStatus,
      sort: activeSort,
      page,
      pageSize: 8
    };

    setIsLoading(true);
    setError(null);

    void listingsRepository
      .list(query)
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("marketplace.loadError"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeSort, activeStatus, listingsRepository, page, search, t]);

  const quickPresets: Array<{ key: QuickPreset; label: string }> = [
    { key: "all", label: t("marketplace.quickFilters.all") },
    { key: "available", label: t("marketplace.quickFilters.available") },
    { key: "reserved", label: t("marketplace.quickFilters.reserved") },
    { key: "withImages", label: t("marketplace.quickFilters.withImages") },
    { key: "newest", label: t("marketplace.quickFilters.newest") },
    { key: "priceLow", label: t("marketplace.quickFilters.priceLow") }
  ];

  const filteredItems = withImagesOnly ? data.items.filter((item) => getPrimaryListingImageUrl(item.imageUrl) !== null) : data.items;

  const listLabel = t("marketplace.listCount", { count: filteredItems.length });
  const countLabel = t("marketplace.listCount", { count: data.totalItems });

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View style={[styles.heroHeader, isRtl ? styles.heroHeaderRtl : undefined]}>
          <Image source={require("../../assets/sanany-logo.png")} style={styles.logo} resizeMode="contain" />
          <View style={styles.countPill}>
            <Text style={styles.countPillLabel}>{countLabel}</Text>
          </View>
        </View>
        <Text style={[styles.pageTitle, { textAlign }]}>{t("marketplace.pageTitle")}</Text>
        <Text style={[styles.pageSubtitle, { textAlign }]}>{t("marketplace.pageSubtitle")}</Text>
        {snapshot.user?.email ? <Text style={[styles.userHint, { textAlign }]}>{t("marketplace.signOutHint", { email: snapshot.user.email })}</Text> : null}
      </View>

      <View style={[styles.toolbar, isRtl ? styles.toolbarRtl : undefined]}>
        <View style={[styles.searchShell, isRtl ? styles.searchShellRtl : undefined]}>
          <MobileIcon name="search" size={18} color="#64748b" />
          <TextInput
            style={[styles.searchInput, { textAlign }]}
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={t("marketplace.searchPlaceholder")}
          />
        </View>
        <Pressable
          style={styles.signOutAction}
          onPress={() => {
            void signOut();
          }}
        >
          <MobileIcon name="signOut" size={16} color="#475569" />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { textAlign }]}>{t("marketplace.loadError")}</Text>
          <Text style={[styles.errorHint, { textAlign }]}>{error}</Text>
        </View>
      ) : null}
      {isLoading ? <Text style={[styles.loadingText, { textAlign }]}>{t("common.loading")}</Text> : null}
      {!isLoading && filteredItems.length === 0 ? (
        <MobileEmptyState direction={direction} icon="marketplace" title={t("marketplace.pageTitle")} description={t("marketplace.emptyState")} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.filterSection}>
            <Text style={[styles.sectionTitle, { textAlign }]}>{t("marketplace.quickFiltersTitle")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.quickChipsRow, isRtl ? styles.quickChipsRowRtl : undefined]}>
              {quickPresets.map((preset) => (
                <Pressable
                  key={preset.key}
                  style={[styles.quickChip, quickPreset === preset.key ? styles.quickChipActive : undefined]}
                  onPress={() => {
                    setQuickPreset(preset.key);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.quickChipLabel, quickPreset === preset.key ? styles.quickChipLabelActive : undefined]}>{preset.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.listSection}>
            <MobileSectionHeader direction={direction} title={t("marketplace.listSectionTitle")} subtitle={listLabel} />
            <View style={styles.gridList}>
              {filteredItems.map((item) => {
                return (
                  <MobileListingTile key={item.id} direction={direction} listing={item} width="48.5%" onPress={() => onOpenListing(item)} />
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[styles.pagination, isRtl ? styles.paginationRtl : undefined]}>
        <Pressable
          style={[styles.pageButton, page <= 1 ? styles.secondaryButtonDisabled : undefined]}
          disabled={page <= 1 || isLoading}
          onPress={() => setPage((current) => Math.max(1, current - 1))}
        >
          <Text style={styles.pageButtonLabel}>{t("common.previous")}</Text>
        </Pressable>
        <Text style={styles.paginationLabel}>{t("common.page", { current: data.page, total: data.totalPages })}</Text>
        <Pressable
          style={[styles.pageButton, page >= data.totalPages ? styles.secondaryButtonDisabled : undefined]}
          disabled={page >= data.totalPages || isLoading}
          onPress={() => setPage((current) => Math.min(data.totalPages, current + 1))}
        >
          <Text style={styles.pageButtonLabel}>{t("common.next")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  heroCard: {
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: "#dff7f3",
    padding: 18
  },
  heroHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroHeaderRtl: {
    flexDirection: "row-reverse"
  },
  logo: {
    width: 104,
    height: 34
  },
  countPill: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  countPillLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a"
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: "#475569"
  },
  userHint: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748b"
  },
  toolbar: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  toolbarRtl: {
    flexDirection: "row-reverse"
  },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14
  },
  searchShellRtl: {
    flexDirection: "row-reverse"
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a"
  },
  signOutAction: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ffffff"
  },
  filterSection: {
    gap: 8
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b"
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 2
  },
  quickChipsRowRtl: {
    flexDirection: "row-reverse"
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  quickChipActive: {
    borderColor: "#99f6e4",
    backgroundColor: "#ecfdfa"
  },
  quickChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  quickChipLabelActive: {
    color: "#0f766e"
  },
  listSection: {
    marginTop: 14
  },
  gridList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10
  },
  scrollContent: {
    gap: 4,
    paddingBottom: 10
  },
  pageButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  secondaryButtonDisabled: {
    opacity: 0.45
  },
  pageButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  errorBox: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 10
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#b91c1c"
  },
  errorHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#7f1d1d"
  },
  loadingText: {
    marginBottom: 8,
    fontSize: 13,
    color: "#475569"
  },
  pagination: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  paginationRtl: {
    flexDirection: "row-reverse"
  },
  paginationLabel: {
    fontSize: 12,
    color: "#475569"
  }
});
