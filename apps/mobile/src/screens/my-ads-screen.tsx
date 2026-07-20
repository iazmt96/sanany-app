import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ListingSalePayment, MarketplaceCommissionSettings, MarketplaceListing, PaginatedResult } from "@sanany/types";
import { buildCommissionReviewPreview, formatCurrencySar, matchesListingManagementSection, type CommissionReviewPreviewState, shouldShowSaleCompletionAction } from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileEmptyState } from "../components/mobile-empty-state";
import { MobileIcon } from "../components/mobile-icons";
import { MobileListingTile } from "../components/mobile-listing-tile";
import { MyAdsSaleSheet } from "../components/my-ads-sale-sheet";
import { MobileSectionHeader } from "../components/mobile-section-header";
import { getMobileListingsRepository } from "../lib/listings-repository";

type MyAdsScreenProps = {
  direction: Direction;
  onExploreMarketplace(): void;
  onOpenListing(listing: MarketplaceListing): void;
  previewState?: CommissionReviewPreviewState | null;
  commissionListingId?: string | null;
  onCommissionListingHandled?(): void;
};

const PAGE_SIZE = 6;
const MANAGEMENT_TABS = ["active", "sold", "drafts", "expired"] as const;
type ManagementTab = (typeof MANAGEMENT_TABS)[number];

export function MyAdsScreen({
  direction,
  onExploreMarketplace,
  onOpenListing,
  previewState = null,
  commissionListingId = null,
  onCommissionListingHandled
}: MyAdsScreenProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const previewData = useMemo(() => (previewState ? buildCommissionReviewPreview(i18n.language || "ar", previewState) : null), [i18n.language, previewState]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ManagementTab>("active");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: 120,
    totalPages: 1
  });
  const [salePayments, setSalePayments] = useState<ListingSalePayment[]>([]);
  const [commissionSettings, setCommissionSettings] = useState<MarketplaceCommissionSettings | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const textAlign = direction === "rtl" ? "right" : "left";

  useEffect(() => {
    if (previewData) {
      setData({
        items: previewData.listings,
        totalItems: previewData.listings.length,
        page: 1,
        pageSize: 120,
        totalPages: 1
      });
      setSalePayments(previewData.payments);
      setCommissionSettings(previewData.settings);
      setTab(previewData.section);
      setSelectedListingId(previewData.selectedListingId);
      setIsLoading(false);
      setError(null);
      return;
    }
    if (!snapshot.user?.id) {
      setIsLoading(false);
      setData({ items: [], totalItems: 0, page: 1, pageSize: 120, totalPages: 1 });
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      listingsRepository.listByOwner(snapshot.user.id, {
        search: "",
        status: "all",
        sort: "newest",
        page: 1,
        pageSize: 120
      }),
      listingsRepository.listSalePaymentsBySeller(snapshot.user.id),
      listingsRepository.getCommissionSettings()
    ])
      .then(([listingsResult, paymentsResult, settingsResult]) => {
        if (!active) {
          return;
        }
        setData(listingsResult);
        setSalePayments(paymentsResult);
        setCommissionSettings(settingsResult);
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
  }, [listingsRepository, previewData, snapshot.user?.id, t]);

  useEffect(() => {
    setPage(1);
  }, [search, tab]);

  useEffect(() => {
    if (!commissionListingId || isLoading) {
      return;
    }

    const targetListing = data.items.find((item) => item.id === commissionListingId);
    if (!targetListing) {
      return;
    }

    setSelectedListingId(targetListing.id);
    if (targetListing.status === "sold") {
      setTab("sold");
    } else if (targetListing.status === "draft") {
      setTab("drafts");
    } else {
      setTab("active");
    }
    setPage(1);
    onCommissionListingHandled?.();
  }, [commissionListingId, data.items, isLoading, onCommissionListingHandled]);

  const selectedListing = useMemo(() => data.items.find((item) => item.id === selectedListingId) ?? null, [data.items, selectedListingId]);
  const selectedPayment = useMemo(
    () => (selectedListing ? salePayments.find((item) => item.listingId === selectedListing.id) ?? null : null),
    [salePayments, selectedListing]
  );

  const visibleListings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.items.filter((listing) => {
      if (!matchesListingManagementSection(listing, tab)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = `${listing.title} ${listing.description ?? ""} ${listing.locationName ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [data.items, search, tab]);

  const visibleData = useMemo(() => {
    const totalItems = visibleListings.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * PAGE_SIZE;

    return {
      items: visibleListings.slice(from, from + PAGE_SIZE),
      totalItems,
      page: safePage,
      pageSize: PAGE_SIZE,
      totalPages
    };
  }, [page, visibleListings]);

  const badge = t("marketplace.listCount", { count: visibleData.totalItems });

  const handlePaymentUpdated = (payment: ListingSalePayment) => {
    setSalePayments((current) => {
      const next = current.filter((item) => item.listingId !== payment.listingId);
      next.unshift(payment);
      return next;
    });

    if (payment.paymentStatus === "paid") {
      setData((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === payment.listingId ? { ...item, status: "sold" } : item))
      }));
      setTab("sold");
      setPage(1);
    }
  };

  return (
    <View style={styles.container}>
      <MobileSectionHeader direction={direction} title={t("myAds.pageTitle")} subtitle={t("myAds.pageSubtitle")} badge={badge} />

      <View style={[styles.searchShell, direction === "rtl" ? styles.searchShellRtl : undefined]}>
        <MobileIcon name="search" size={18} color="#64748b" />
        <TextInput
          style={[styles.searchInput, { textAlign }]}
          value={search}
          onChangeText={setSearch}
          placeholder={t("myAds.searchPlaceholder")}
        />
      </View>

      <View style={[styles.tabsRow, direction === "rtl" ? styles.tabsRowRtl : undefined]}>
        {MANAGEMENT_TABS.map((item) => (
          <Pressable key={item} style={[styles.tabButton, tab === item ? styles.tabButtonActive : undefined]} onPress={() => setTab(item)}>
            <Text style={[styles.tabLabel, tab === item ? styles.tabLabelActive : undefined]}>{t(`myAds.sections.${item}`)}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}
      {isLoading ? <Text style={[styles.infoText, { textAlign }]}>{t("common.loading")}</Text> : null}

      {!isLoading && visibleData.items.length === 0 ? (
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
          data={visibleData.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const payment = salePayments.find((entry) => entry.listingId === item.id) ?? null;
            const canComplete = shouldShowSaleCompletionAction(item, salePayments);

            return (
              <View style={styles.tileWrap}>
                <MobileListingTile direction={direction} listing={item} onPress={() => onOpenListing(item)} width="100%" />
                {payment ? (
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentInfoLabel}>{t(`myAds.saleFlow.paymentStates.${payment.paymentStatus}`)}</Text>
                    <Text style={styles.paymentInfoValue}>
                      {payment.paymentStatus === "paid" ? t("marketplace.status.sold") : t("myAds.saleFlow.amountLabel")}
                    </Text>
                    <Text style={styles.paymentMeta}>{`${t("myAds.saleFlow.amountLabel")}: ${formatCurrencySar(payment.finalSaleAmount, i18n.language || "ar")}`}</Text>
                    <Text style={styles.paymentMeta}>{`${t("myAds.saleFlow.commissionAmount")}: ${formatCurrencySar(payment.commissionAmount, i18n.language || "ar")}`}</Text>
                    <Text style={styles.paymentMeta}>{`${t("myAds.saleFlow.soldDate")}: ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString(i18n.language || "ar") : "—"}`}</Text>
                    {payment.paymentStatus === "paid" ? (
                      <Pressable style={styles.secondaryAction} onPress={() => setSelectedListingId(item.id)}>
                        <Text style={styles.secondaryActionLabel}>{t("myAds.saleFlow.invoiceView")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {canComplete ? (
                  <Pressable style={[styles.primaryAction, !commissionSettings ? styles.primaryActionDisabled : undefined]} onPress={() => setSelectedListingId(item.id)} disabled={!commissionSettings}>
                    <Text style={styles.primaryActionLabel}>{t("myAds.saleFlow.action")}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <View style={styles.pagination}>
        <Pressable
          style={[styles.pagerButton, visibleData.page <= 1 ? styles.disabled : undefined]}
          disabled={visibleData.page <= 1 || isLoading}
          onPress={() => setPage((current) => Math.max(1, current - 1))}
        >
          <Text style={styles.pagerLabel}>{t("common.previous")}</Text>
        </Pressable>
        <Text style={styles.pageLabel}>{t("common.page", { current: visibleData.page, total: visibleData.totalPages })}</Text>
        <Pressable
          style={[styles.pagerButton, visibleData.page >= visibleData.totalPages ? styles.disabled : undefined]}
          disabled={visibleData.page >= visibleData.totalPages || isLoading}
          onPress={() => setPage((current) => Math.min(visibleData.totalPages, current + 1))}
        >
          <Text style={styles.pagerLabel}>{t("common.next")}</Text>
        </Pressable>
      </View>

      <MyAdsSaleSheet
        visible={selectedListing !== null}
        direction={direction}
        language={i18n.language || "ar"}
        listing={selectedListing}
        sellerId={previewData?.sellerId ?? snapshot.user?.id ?? null}
        settings={commissionSettings}
        payment={selectedPayment}
        onClose={() => setSelectedListingId(null)}
        onPaymentUpdated={handlePaymentUpdated}
        preview={
          previewData && selectedListing
            ? {
                amount: previewData.amount,
                isConfirmed: previewData.isConfirmed,
                uiState: previewData.uiState,
                invoice: previewData.invoice
              }
            : null
        }
      />
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
    marginBottom: 10,
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
  tabsRow: {
    marginBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tabsRowRtl: {
    flexDirection: "row-reverse"
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  tabButtonActive: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdfa"
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  tabLabelActive: {
    color: "#0f766e"
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
    gap: 12,
    paddingBottom: 10
  },
  gridRow: {
    justifyContent: "space-between"
  },
  tileWrap: {
    width: "48.5%",
    gap: 8
  },
  paymentInfo: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  paymentInfoLabel: {
    fontSize: 11,
    color: "#64748b"
  },
  paymentInfoValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a"
  },
  paymentMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#475569"
  },
  secondaryAction: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  secondaryActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155"
  },
  primaryAction: {
    borderRadius: 16,
    backgroundColor: "#0f766e",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  primaryActionDisabled: {
    opacity: 0.45
  },
  primaryActionLabel: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff"
  },
  pagination: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  pagerButton: {
    borderRadius: 14,
    backgroundColor: "#ecfdfa",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pagerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  disabled: {
    opacity: 0.45
  },
  pageLabel: {
    fontSize: 12,
    color: "#475569"
  }
});
