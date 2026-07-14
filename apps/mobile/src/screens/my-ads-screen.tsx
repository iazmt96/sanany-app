import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ListingFilterStatus, ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileEmptyState } from "../components/mobile-empty-state";
import { MobileListingTile } from "../components/mobile-listing-tile";
import { MobileIcon } from "../components/mobile-icons";
import { MobileSectionHeader } from "../components/mobile-section-header";
import { getMobileListingsRepository } from "../lib/listings-repository";

type MyAdsScreenProps = {
  direction: Direction;
  onExploreMarketplace(): void;
  onOpenListing(listing: MarketplaceListing): void;
};

const PAGE_SIZE = 6;

export function MyAdsScreen({ direction, onExploreMarketplace, onOpenListing }: MyAdsScreenProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "priceHigh" | "priceLow">("newest");
  const [statusFilter, setStatusFilter] = useState<ListingFilterStatus>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });
  const textAlign = direction === "rtl" ? "right" : "left";

  useEffect(() => {
    if (!snapshot.user?.id) {
      setIsLoading(false);
      setData({ items: [], totalItems: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
      return;
    }

    const query: ListingsQuery = { search, status: statusFilter, sort, page, pageSize: PAGE_SIZE };
    let active = true;
    setIsLoading(true);
    setError(null);

    void listingsRepository
      .listByOwner(snapshot.user.id, query)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : t("marketplace.loadError"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listingsRepository, page, search, snapshot.user?.id, sort, statusFilter, t]);

  const sortLabel =
    sort === "newest" ? t("marketplace.sort.newest") : sort === "priceHigh" ? t("marketplace.sort.priceHigh") : t("marketplace.sort.priceLow");
  const badge = t("marketplace.listCount", { count: data.totalItems });

  return (
    <View style={styles.container}>
      <MobileSectionHeader direction={direction} title={t("myAds.pageTitle")} subtitle={t("myAds.pageSubtitle")} badge={badge} />

      <View style={[styles.searchShell, direction === "rtl" ? styles.searchShellRtl : undefined]}>
        <MobileIcon name="search" size={18} color="#64748b" />
        <TextInput
          style={[styles.searchInput, { textAlign }]}
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={t("myAds.searchPlaceholder")}
        />
      </View>

      <Pressable
        style={styles.controlButton}
        onPress={() => {
          const next = sort === "newest" ? "priceHigh" : sort === "priceHigh" ? "priceLow" : "newest";
          setSort(next);
          setPage(1);
        }}
      >
        <MobileIcon name="sort" size={16} color="#0f766e" />
        <Text style={styles.controlLabel}>{sortLabel}</Text>
      </Pressable>

      <Pressable
        style={styles.controlButton}
        onPress={() => {
          const next: ListingFilterStatus = statusFilter === "all" ? "draft" : statusFilter === "draft" ? "available" : statusFilter === "available" ? "reserved" : "all";
          setStatusFilter(next);
          setPage(1);
        }}
      >
        <MobileIcon name="filter" size={16} color="#0f766e" />
        <Text style={styles.controlLabel}>{t(`myAds.status${statusFilter.charAt(0).toUpperCase()}${statusFilter.slice(1)}`)}</Text>
      </Pressable>

      {error ? <Text style={[styles.errorText, { textAlign }]}>{t("marketplace.loadError")}</Text> : null}
      {isLoading ? <Text style={[styles.infoText, { textAlign }]}>{t("common.loading")}</Text> : null}
      {!isLoading && data.items.length === 0 ? (
        <MobileEmptyState
          direction={direction}
          icon="myAds"
          title={t("myAds.emptyTitle")}
          description={t("myAds.emptyHint")}
          actionLabel={t("myAds.exploreMarketplace")}
          onPressAction={onExploreMarketplace}
        />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MobileListingTile direction={direction} listing={item} width="48.5%" onPress={() => onOpenListing(item)} />
          )}
        />
      )}

      <View style={styles.pagination}>
        <Pressable style={[styles.controlButton, page <= 1 ? styles.disabled : undefined]} disabled={page <= 1 || isLoading} onPress={() => setPage((current) => Math.max(1, current - 1))}>
          <Text style={styles.controlLabel}>{t("common.previous")}</Text>
        </Pressable>
        <Text style={styles.pageLabel}>{t("common.page", { current: data.page, total: data.totalPages })}</Text>
        <Pressable
          style={[styles.controlButton, page >= data.totalPages ? styles.disabled : undefined]}
          disabled={page >= data.totalPages || isLoading}
          onPress={() => setPage((current) => Math.min(data.totalPages, current + 1))}
        >
          <Text style={styles.controlLabel}>{t("common.next")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: "#0f172a"
  },
  searchShell: {
    marginBottom: 8,
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
  controlButton: {
    marginBottom: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#ecfdfa",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  disabled: {
    opacity: 0.45
  },
  errorText: {
    marginBottom: 8,
    fontSize: 13,
    color: "#b91c1c"
  },
  infoText: {
    marginBottom: 8,
    fontSize: 13,
    color: "#475569"
  },
  listContent: {
    gap: 10,
    paddingBottom: 10
  },
  gridRow: {
    justifyContent: "space-between"
  },
  pagination: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  pageLabel: {
    fontSize: 12,
    color: "#475569"
  }
});
