import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  RECENT_SEARCHES_STORAGE_KEY,
  SAVED_SEARCHES_STORAGE_KEY,
  parseStoredIdList,
  parseStoredSearches,
  upsertStoredSearch,
  type StoredSearch
} from "@sanany/shared";
import type { ListingsQuery, MarketplaceCategoryNode, MarketplaceListing, SellerProfile } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileIcon } from "../components/mobile-icons";
import { MobileListingTile } from "../components/mobile-listing-tile";
import { MobileSectionHeader } from "../components/mobile-section-header";
import { getMobileCategoriesRepository } from "../lib/categories-repository";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { getMobileSellersRepository } from "../lib/sellers-repository";

type MarketplaceScreenProps = {
  direction: Direction;
  onOpenListing(listing: MarketplaceListing): void;
  onOpenSearch(initialSearch?: string): void;
  onOpenMyAds(): void;
  previewState?: "loading" | "error" | "empty" | "guest";
};

type CityKey = "riyadh" | "jeddah" | "dammam" | "makkah" | "madinah";
type OwnerSummary = {
  active: number;
  drafts: number;
  reserved: number;
};

const CITY_KEYS: readonly CityKey[] = ["riyadh", "jeddah", "dammam", "makkah", "madinah"];
const EXPERIENCE_EMOJI: Record<MarketplaceCategoryNode["experienceKey"], string> = {
  general: "📦",
  vehicles: "🚗",
  real_estate: "🏠",
  electronics: "📱",
  livestock: "🐑",
  jobs: "💼",
  services: "🛠️"
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function listingMatchesCity(listing: MarketplaceListing, cityLabel: string): boolean {
  if (!listing.locationName || cityLabel.trim().length === 0) {
    return false;
  }

  return normalizeText(listing.locationName).includes(normalizeText(cityLabel));
}

function listingMatchesSearch(listing: MarketplaceListing, search: StoredSearch): boolean {
  const query = search.query.trim().toLowerCase();
  const haystack = [listing.title, listing.description ?? "", listing.locationName ?? "", listing.categorySlug ?? ""].join(" ").toLowerCase();
  if (query.length > 0 && !haystack.includes(query)) {
    return false;
  }

  if (search.city && !listingMatchesCity(listing, search.city)) {
    return false;
  }

  if (search.categorySlug && listing.categorySlug !== search.categorySlug) {
    return false;
  }

  return true;
}

function selectListingsByIds(ids: string[], items: MarketplaceListing[]): MarketplaceListing[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => itemMap.get(id)).filter((item): item is MarketplaceListing => Boolean(item));
}

function uniqueListings(items: MarketplaceListing[]): MarketplaceListing[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function HomePlaceholder() {
  return (
    <View style={styles.placeholderWrap}>
      <View style={styles.placeholderHero} />
      <View style={styles.placeholderRow}>
        <View style={styles.placeholderCard} />
        <View style={styles.placeholderCard} />
      </View>
      <View style={styles.placeholderGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={`placeholder-${index}`} style={styles.placeholderTile} />
        ))}
      </View>
    </View>
  );
}

export function MarketplaceScreen({ direction, onOpenListing, onOpenSearch, onOpenMyAds, previewState }: MarketplaceScreenProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const sellersRepository = useMemo(() => getMobileSellersRepository(), []);
  const categoriesRepository = useMemo(() => getMobileCategoriesRepository(), []);
  const textAlign = direction === "rtl" ? "right" : "left";
  const isRtl = direction === "rtl";

  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityKey>("riyadh");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategoryNode[]>([]);
  const [sellerMap, setSellerMap] = useState<Map<string, SellerProfile>>(new Map());
  const [trustedSellers, setTrustedSellers] = useState<SellerProfile[]>([]);
  const [recentSearches, setRecentSearches] = useState<StoredSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<StoredSearch[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentViewIds, setRecentViewIds] = useState<string[]>([]);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);

  const selectedCityLabel = t(`siteLayout.cities.${selectedCity}`);

  useEffect(() => {
    let active = true;
    const query: ListingsQuery = { search: "", status: "all", sort: "newest", page: 1, pageSize: 80 };

    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [listingsResult, categoryTree] = await Promise.all([listingsRepository.list(query), categoriesRepository.listCategoryTree()]);
        if (!active) {
          return;
        }

        const nextListings = previewState === "empty" ? [] : listingsResult.items;
        setListings(nextListings);
        setCategories(categoryTree.slice(0, 8));

        const ownerIds = Array.from(
          new Set(nextListings.map((item) => item.ownerId).filter((ownerId): ownerId is string => typeof ownerId === "string" && ownerId.length > 0))
        ).slice(0, 14);
        const profiles = await Promise.all(ownerIds.map((ownerId) => sellersRepository.getProfile(ownerId, snapshot.user?.id ?? null)));
        if (!active) {
          return;
        }

        const nextSellerMap = new Map(
          profiles.filter((profile): profile is SellerProfile => profile !== null).map((profile) => [profile.id, profile] as const)
        );
        setSellerMap(nextSellerMap);
        setTrustedSellers(
          [...nextSellerMap.values()]
            .filter((seller) => seller.isVerified)
            .sort((left, right) => right.ratingCount - left.ratingCount || right.listingsCount - left.listingsCount)
            .slice(0, 4)
        );
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

    if (previewState === "error") {
      setError(t("marketplace.loadError"));
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    void run();
    return () => {
      active = false;
    };
  }, [categoriesRepository, listingsRepository, previewState, sellersRepository, snapshot.user?.id, t]);

  useEffect(() => {
    let active = true;

    const loadSignals = async () => {
      try {
        const [recentRaw, savedRaw, favoritesRaw, viewedRaw] = await Promise.all([
          AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY),
          AsyncStorage.getItem(SAVED_SEARCHES_STORAGE_KEY),
          AsyncStorage.getItem(FAVORITES_STORAGE_KEY),
          AsyncStorage.getItem(LISTING_VIEWS_STORAGE_KEY)
        ]);
        if (!active) {
          return;
        }

        setRecentSearches(parseStoredSearches(recentRaw));
        setSavedSearches(parseStoredSearches(savedRaw));
        setFavoriteIds(parseStoredIdList(favoritesRaw));
        setRecentViewIds(parseStoredIdList(viewedRaw));
      } catch {
        if (active) {
          setRecentSearches([]);
          setSavedSearches([]);
          setFavoriteIds([]);
          setRecentViewIds([]);
        }
      }
    };

    void loadSignals();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (previewState === "guest" || !snapshot.user?.id) {
      setOwnerSummary(null);
      return;
    }

    let active = true;
    const ownerId = snapshot.user.id;

    const run = async () => {
      try {
        const [activeListings, draftListings, reservedListings] = await Promise.all([
          listingsRepository.listByOwner(ownerId, { search: "", status: "available", sort: "newest", page: 1, pageSize: 1 }),
          listingsRepository.listByOwner(ownerId, { search: "", status: "draft", sort: "newest", page: 1, pageSize: 1 }),
          listingsRepository.listByOwner(ownerId, { search: "", status: "reserved", sort: "newest", page: 1, pageSize: 1 })
        ]);
        if (!active) {
          return;
        }

        setOwnerSummary({
          active: activeListings.totalItems,
          drafts: draftListings.totalItems,
          reserved: reservedListings.totalItems
        });
      } catch {
        if (active) {
          setOwnerSummary(null);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [listingsRepository, previewState, snapshot.user?.id]);

  const recentViewedListings = useMemo(() => selectListingsByIds(recentViewIds, listings).slice(0, 6), [listings, recentViewIds]);
  const favoriteListings = useMemo(() => selectListingsByIds(favoriteIds, listings).slice(0, 6), [favoriteIds, listings]);
  const nearbyListings = useMemo(() => listings.filter((listing) => listingMatchesCity(listing, selectedCityLabel)).slice(0, 6), [listings, selectedCityLabel]);
  const freshListings = useMemo(() => [...listings].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 6), [listings]);
  const personalizedListings = useMemo(() => {
    const sourceSearches = [...savedSearches, ...recentSearches].slice(0, 6);
    const matched = uniqueListings(sourceSearches.flatMap((item) => listings.filter((listing) => listingMatchesSearch(listing, item))));
    if (matched.length > 0) {
      return matched.slice(0, 6);
    }

    return uniqueListings([...favoriteListings, ...nearbyListings, ...freshListings]).slice(0, 6);
  }, [favoriteListings, freshListings, listings, nearbyListings, recentSearches, savedSearches]);

  const persistSearch = async (storageKey: typeof RECENT_SEARCHES_STORAGE_KEY | typeof SAVED_SEARCHES_STORAGE_KEY) => {
    const raw = await AsyncStorage.getItem(storageKey);
    const next = upsertStoredSearch(raw, { query: search, city: selectedCityLabel });
    await AsyncStorage.setItem(storageKey, next.serialized);
    if (storageKey === RECENT_SEARCHES_STORAGE_KEY) {
      setRecentSearches(next.items);
    } else {
      setSavedSearches(next.items);
    }
  };

  const categoryCards = categories.slice(0, 6);

  if (previewState === "loading" || isLoading) {
    return <HomePlaceholder />;
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={[styles.eyebrow, { textAlign }]}>{t("home.hero.eyebrow")}</Text>
        <Text style={[styles.pageTitle, { textAlign }]}>{t("home.hero.title")}</Text>
        <Text style={[styles.pageSubtitle, { textAlign }]}>{t("home.hero.subtitle")}</Text>

        <View style={[styles.searchShell, isRtl ? styles.searchShellRtl : undefined]}>
          <MobileIcon name="search" size={18} color="#64748b" />
          <TextInput
            style={[styles.searchInput, { textAlign }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t("home.hero.searchPlaceholder")}
          />
        </View>

        <View style={[styles.cityRow, isRtl ? styles.cityRowRtl : undefined]}>
          {CITY_KEYS.map((cityKey) => {
            const isActive = selectedCity === cityKey;
            return (
              <Pressable key={cityKey} style={[styles.cityChip, isActive ? styles.cityChipActive : undefined]} onPress={() => setSelectedCity(cityKey)}>
                <Text style={[styles.cityChipLabel, isActive ? styles.cityChipLabelActive : undefined]}>{t(`siteLayout.cities.${cityKey}`)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.heroActions, isRtl ? styles.heroActionsRtl : undefined]}>
          <Pressable
            style={styles.primaryAction}
            onPress={() => {
              void persistSearch(RECENT_SEARCHES_STORAGE_KEY).finally(() => onOpenSearch(search));
            }}
          >
            <Text style={styles.primaryActionLabel}>{t("home.hero.searchAction")}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryAction, search.trim().length === 0 ? styles.secondaryActionDisabled : undefined]}
            disabled={search.trim().length === 0}
            onPress={() => {
              void persistSearch(SAVED_SEARCHES_STORAGE_KEY);
            }}
          >
            <Text style={styles.secondaryActionLabel}>{t("home.hero.saveSearch")}</Text>
          </Pressable>
        </View>

        <Text style={[styles.helperText, { textAlign }]}>{t("home.hero.helper")}</Text>
      </View>

      <View style={styles.intentGrid}>
        {[
          { key: "findSpecific", action: () => onOpenSearch(search), icon: "search" as const },
          { key: "discover", action: () => undefined, icon: "categories" as const },
          { key: "compare", action: () => onOpenSearch(savedSearches[0]?.query ?? ""), icon: "filter" as const },
          { key: "monitor", action: () => setSelectedCity((current) => current), icon: "time" as const },
          { key: "continue", action: () => (recentViewedListings[0] ? onOpenListing(recentViewedListings[0]) : onOpenSearch("")), icon: "views" as const },
          { key: "manage", action: onOpenMyAds, icon: "myAds" as const }
        ].map((item) => (
          <Pressable key={item.key} style={styles.intentCard} onPress={item.action}>
            <View style={styles.intentIconWrap}>
              <MobileIcon name={item.icon} size={18} color="#0f766e" focused />
            </View>
            <Text style={[styles.intentTitle, { textAlign }]}>{t(`home.intents.${item.key}.title`)}</Text>
            <Text style={[styles.intentDescription, { textAlign }]}>{t(`home.intents.${item.key}.description`)}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { textAlign }]}>{t("marketplace.loadError")}</Text>
          <Text style={[styles.errorHint, { textAlign }]}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <MobileSectionHeader direction={direction} title={t("home.sections.yourMarket")} subtitle={t("home.sectionDescriptions.yourMarket")} />
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={[styles.metricTitle, { textAlign }]}>{t("home.activity.recentSearches")}</Text>
            <Text style={styles.metricValue}>{recentSearches.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricTitle, { textAlign }]}>{t("home.activity.savedSearches")}</Text>
            <Text style={styles.metricValue}>{savedSearches.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricTitle, { textAlign }]}>{t("home.activity.recentlyViewed")}</Text>
            <Text style={styles.metricValue}>{recentViewedListings.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricTitle, { textAlign }]}>{t("home.activity.nearby")}</Text>
            <Text style={styles.metricValue}>{nearbyListings.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <MobileSectionHeader direction={direction} title={t("home.sections.yourListings")} subtitle={t("home.sectionDescriptions.yourListings")} />
        {previewState !== "guest" && ownerSummary ? (
          <View style={styles.ownerGrid}>
            <View style={[styles.ownerMetricCard, styles.ownerMetricActive]}>
              <Text style={styles.ownerMetricLabel}>{t("home.owner.active")}</Text>
              <Text style={styles.ownerMetricValue}>{ownerSummary.active}</Text>
            </View>
            <View style={[styles.ownerMetricCard, styles.ownerMetricDrafts]}>
              <Text style={styles.ownerMetricLabel}>{t("home.owner.drafts")}</Text>
              <Text style={styles.ownerMetricValue}>{ownerSummary.drafts}</Text>
            </View>
            <View style={[styles.ownerMetricCard, styles.ownerMetricReserved]}>
              <Text style={styles.ownerMetricLabel}>{t("home.owner.reserved")}</Text>
              <Text style={styles.ownerMetricValue}>{ownerSummary.reserved}</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.guestCopy, { textAlign }]}>{t("home.owner.guestDescription")}</Text>
        )}
        <Pressable style={styles.workspaceAction} onPress={onOpenMyAds}>
          <Text style={styles.workspaceActionLabel}>{t("home.owner.manageAction")}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <MobileSectionHeader direction={direction} title={t("home.sections.categories")} subtitle={t("home.sectionDescriptions.categories")} />
        <View style={[styles.categoryGrid, isRtl ? styles.categoryGridRtl : undefined]}>
          {categoryCards.map((category) => (
            <Pressable key={category.id} style={styles.categoryCard} onPress={() => onOpenSearch(resolvedCategoryLabel(category, direction === "rtl"))}>
              <Text style={styles.categoryEmoji}>{EXPERIENCE_EMOJI[category.experienceKey]}</Text>
              <Text style={[styles.categoryTitle, { textAlign }]}>{resolvedCategoryLabel(category, direction === "rtl")}</Text>
              <Text style={[styles.categoryHint, { textAlign }]}>{t("home.categories.childCount", { count: category.children.length || 1 })}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {savedSearches.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.savedSearches")} subtitle={t("home.sectionDescriptions.savedSearches")} />
          <View style={styles.savedGrid}>
            {savedSearches.slice(0, 4).map((item) => (
              <Pressable key={item.id} style={styles.savedCard} onPress={() => onOpenSearch(item.query)}>
                <Text style={[styles.savedTitle, { textAlign }]}>{item.query}</Text>
                <Text style={[styles.savedHint, { textAlign }]}>{item.city ?? t("home.search.anywhere")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {[
        { key: "personalized", subtitle: t("home.sectionDescriptions.personalized"), items: personalizedListings, insight: t("home.card.recommended") },
        { key: "recentlyViewed", subtitle: t("home.sectionDescriptions.recentlyViewed"), items: recentViewedListings, insight: t("home.card.continue") },
        { key: "nearby", subtitle: t("home.sectionDescriptions.nearby", { city: selectedCityLabel }), items: nearbyListings, insight: selectedCityLabel },
        { key: "newToday", subtitle: t("home.sectionDescriptions.newToday"), items: freshListings, insight: t("home.card.new") }
      ].map((section) =>
        section.items.length > 0 ? (
          <View key={section.key} style={styles.sectionCard}>
            <MobileSectionHeader direction={direction} title={t(`home.sections.${section.key}`)} subtitle={section.subtitle} />
            <View style={styles.listingGrid}>
              {section.items.map((item) => (
                <MobileListingTile
                  key={`${section.key}-${item.id}`}
                  direction={direction}
                  listing={item}
                  width="48.5%"
                  onPress={() => onOpenListing(item)}
                  sellerProfile={item.ownerId ? sellerMap.get(item.ownerId) ?? null : null}
                  insightLabel={section.insight}
                />
              ))}
            </View>
          </View>
        ) : null
      )}

      {trustedSellers.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.trustedSellers")} subtitle={t("home.sectionDescriptions.trustedSellers")} />
          <View style={styles.savedGrid}>
            {trustedSellers.map((seller) => (
              <View key={seller.id} style={styles.sellerCard}>
                <View style={[styles.sellerHeader, isRtl ? styles.sellerHeaderRtl : undefined]}>
                  <View style={styles.sellerMeta}>
                    <Text style={[styles.sellerName, { textAlign }]} numberOfLines={1}>
                      {seller.displayName}
                    </Text>
                    <Text style={[styles.sellerUsername, { textAlign }]} numberOfLines={1}>
                      @{seller.username ?? t("home.seller.defaultUsername")}
                    </Text>
                  </View>
                  <MobileIcon name="verified" size={18} color="#059669" focused />
                </View>
                <View style={styles.sellerStats}>
                  <View style={styles.sellerStat}>
                    <Text style={styles.sellerStatValue}>{seller.ratingAverage.toFixed(1)}</Text>
                    <Text style={styles.sellerStatLabel}>{t("home.trustedSeller.rating")}</Text>
                  </View>
                  <View style={styles.sellerStat}>
                    <Text style={styles.sellerStatValue}>{seller.ratingCount}</Text>
                    <Text style={styles.sellerStatLabel}>{t("home.trustedSeller.reviews")}</Text>
                  </View>
                  <View style={styles.sellerStat}>
                    <Text style={styles.sellerStatValue}>{seller.listingsCount}</Text>
                    <Text style={styles.sellerStatLabel}>{t("home.trustedSeller.listings")}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {listings.length === 0 && !error ? (
        <View style={styles.sectionCard}>
          <Text style={[styles.emptyTitle, { textAlign }]}>{t("home.empty.title")}</Text>
          <Text style={[styles.emptyHint, { textAlign }]}>{t("home.empty.description")}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function resolvedCategoryLabel(category: MarketplaceCategoryNode, isArabic: boolean): string {
  return isArabic ? category.nameAr : category.nameEn;
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: 14,
    paddingBottom: 22
  },
  placeholderWrap: {
    gap: 14
  },
  placeholderHero: {
    height: 220,
    borderRadius: 28,
    backgroundColor: "#e2e8f0"
  },
  placeholderRow: {
    flexDirection: "row",
    gap: 10
  },
  placeholderCard: {
    flex: 1,
    height: 110,
    borderRadius: 24,
    backgroundColor: "#e2e8f0"
  },
  placeholderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  placeholderTile: {
    width: "48.5%",
    height: 230,
    borderRadius: 24,
    backgroundColor: "#e2e8f0"
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#f4fbfa",
    padding: 18
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0f766e",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  pageTitle: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 36,
    color: "#0f172a"
  },
  pageSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: "#475569"
  },
  searchShell: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 20,
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
    paddingVertical: 14,
    fontSize: 14,
    color: "#0f172a"
  },
  cityRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  cityRowRtl: {
    flexDirection: "row-reverse"
  },
  cityChip: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  cityChipActive: {
    backgroundColor: "#0f766e"
  },
  cityChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  cityChipLabelActive: {
    color: "#ffffff"
  },
  heroActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10
  },
  heroActionsRtl: {
    flexDirection: "row-reverse"
  },
  primaryAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#0f766e",
    paddingVertical: 14
  },
  primaryActionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff"
  },
  secondaryAction: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  secondaryActionDisabled: {
    opacity: 0.45
  },
  secondaryActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  helperText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  },
  intentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  intentCard: {
    width: "48.5%",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 14
  },
  intentIconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ecfdfa",
    marginBottom: 10
  },
  intentTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  intentDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  },
  errorBox: {
    borderRadius: 22,
    backgroundColor: "#fef2f2",
    padding: 14
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
  sectionCard: {
    borderRadius: 26,
    backgroundColor: "#ffffff",
    padding: 14
  },
  metricsGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCard: {
    width: "48.5%",
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    padding: 14
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  metricValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a"
  },
  ownerGrid: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  ownerMetricCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14
  },
  ownerMetricActive: {
    backgroundColor: "#ecfdf5"
  },
  ownerMetricDrafts: {
    backgroundColor: "#fffbeb"
  },
  ownerMetricReserved: {
    backgroundColor: "#eff6ff"
  },
  ownerMetricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569"
  },
  ownerMetricValue: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a"
  },
  guestCopy: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b"
  },
  workspaceAction: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#0f766e",
    paddingVertical: 13
  },
  workspaceActionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff"
  },
  categoryGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  categoryGridRtl: {
    flexDirection: "row-reverse"
  },
  categoryCard: {
    width: "48.5%",
    borderRadius: 22,
    backgroundColor: "#f8fafc",
    padding: 14
  },
  categoryEmoji: {
    fontSize: 28
  },
  categoryTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  categoryHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748b"
  },
  savedGrid: {
    marginTop: 12,
    gap: 10
  },
  savedCard: {
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    padding: 14
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  savedHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748b"
  },
  listingGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  sellerCard: {
    borderRadius: 22,
    backgroundColor: "#f8fafc",
    padding: 14
  },
  sellerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  sellerHeaderRtl: {
    flexDirection: "row-reverse"
  },
  sellerMeta: {
    flex: 1
  },
  sellerName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  sellerUsername: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b"
  },
  sellerStats: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  sellerStat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    alignItems: "center"
  },
  sellerStatValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a"
  },
  sellerStatLabel: {
    marginTop: 4,
    fontSize: 10,
    color: "#64748b"
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  emptyHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b"
  }
});
