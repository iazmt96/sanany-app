import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ListingFilterStatus, ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";
import { useAuth } from "../auth/auth-context";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { type Direction } from "@sanany/utils";

type MarketplaceScreenProps = {
  direction: Direction;
};

export function MarketplaceScreen({ direction }: MarketplaceScreenProps) {
  const { t } = useTranslation();
  const { snapshot, signOut } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingFilterStatus>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: 5,
    totalPages: 1
  });
  const textAlign = direction === "rtl" ? "right" : "left";

  useEffect(() => {
    let active = true;
    const query: ListingsQuery = {
      search,
      status: statusFilter,
      page,
      pageSize: 5
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
  }, [listingsRepository, page, search, statusFilter, t]);

  const nextStatusFilter = () => {
    const next: ListingFilterStatus =
      statusFilter === "all" ? "available" : statusFilter === "available" ? "reserved" : "all";
    setStatusFilter(next);
    setPage(1);
  };

  const statusFilterLabel =
    statusFilter === "all" ? t("marketplace.filters.all") : statusFilter === "available" ? t("marketplace.filters.available") : t("marketplace.filters.reserved");

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/sanany-logo.png")} style={styles.logo} resizeMode="contain" />
      <Text style={[styles.pageTitle, { textAlign }]}>
        {t("marketplace.pageTitle")}
      </Text>
      <Text style={[styles.pageSubtitle, { textAlign }]}>
        {t("marketplace.pageSubtitle")}
      </Text>
      {snapshot.user?.email ? (
        <Text style={[styles.userHint, { textAlign }]}>{t("marketplace.signOutHint", { email: snapshot.user.email })}</Text>
      ) : null}

      <View style={styles.filters}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={t("marketplace.searchPlaceholder")}
        />
        <Pressable style={styles.filterButton} onPress={nextStatusFilter}>
          <Text style={styles.filterButtonLabel}>{statusFilterLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.headerActions}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void signOut();
          }}
        >
          <Text style={styles.secondaryButtonLabel}>{t("common.signOut")}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t("marketplace.loadError")}</Text>
          <Text style={styles.errorHint}>{error}</Text>
        </View>
      ) : null}
      {isLoading ? <Text style={[styles.loadingText, { textAlign }]}>{t("common.loading")}</Text> : null}
      {!isLoading && data.items.length === 0 ? <Text style={[styles.emptyText, { textAlign }]}>{t("marketplace.emptyState")}</Text> : null}

      <FlatList
        data={data.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t(item.titleKey)}</Text>
              <Text style={styles.badge}>
                {t(`marketplace.status.${item.status}`)}
              </Text>
            </View>
            <Text style={styles.cardSummary}>{t(item.summaryKey)}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.location}>{t(item.locationKey)}</Text>
              <Text style={styles.price}>{t("marketplace.pricePerDay", { value: item.dailyPrice })}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.pagination}>
        <Pressable
          style={[styles.secondaryButton, page <= 1 ? styles.secondaryButtonDisabled : undefined]}
          disabled={page <= 1 || isLoading}
          onPress={() => setPage((current) => Math.max(1, current - 1))}
        >
          <Text style={styles.secondaryButtonLabel}>{t("common.previous")}</Text>
        </Pressable>
        <Text style={styles.paginationLabel}>{t("common.page", { current: data.page, total: data.totalPages })}</Text>
        <Pressable
          style={[styles.secondaryButton, page >= data.totalPages ? styles.secondaryButtonDisabled : undefined]}
          disabled={page >= data.totalPages || isLoading}
          onPress={() => setPage((current) => Math.min(data.totalPages, current + 1))}
        >
          <Text style={styles.secondaryButtonLabel}>{t("common.next")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a"
  },
  logo: {
    width: "100%",
    height: 64,
    marginBottom: 8
  },
  pageSubtitle: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 14,
    color: "#475569"
  },
  userHint: {
    marginBottom: 8,
    fontSize: 12,
    color: "#64748b"
  },
  filters: {
    marginBottom: 12,
    gap: 8
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  filterButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  filterButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155"
  },
  headerActions: {
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  secondaryButtonDisabled: {
    opacity: 0.45
  },
  secondaryButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155"
  },
  errorBox: {
    marginBottom: 10,
    borderRadius: 8,
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
  emptyText: {
    marginBottom: 8,
    fontSize: 13,
    color: "#475569"
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16
  },
  cardHeader: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a"
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  cardSummary: {
    marginBottom: 8,
    fontSize: 14,
    color: "#475569"
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  location: {
    fontSize: 14,
    color: "#64748b"
  },
  price: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155"
  },
  pagination: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  paginationLabel: {
    fontSize: 12,
    color: "#475569"
  }
});
