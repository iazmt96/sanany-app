import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  RECENT_SEARCHES_STORAGE_KEY,
  SAVED_SEARCHES_STORAGE_KEY,
  collectLeafCategories,
  countActiveListingsFilters,
  isCarCategory,
  matchesListingsFilters,
  normalizeListingsFilters,
  parseStoredIdList,
  parseStoredSearches,
  resolveCategorySearchTarget,
  upsertStoredSearch,
  type StoredSearch
} from "@sanany/shared";
import {
  CAR_AD_TYPES,
  CAR_CONDITIONS,
  CAR_FUEL_TYPES,
  CAR_PRICE_MODES,
  SEARCH_CITY_KEYS,
  type FollowedSellerStories,
  type ListingFilterStatus,
  type ListingsFilters,
  type ListingsQuery,
  type MarketplaceCategoryNode,
  type MarketplaceListing,
  type SearchCityKey,
  type SellerProfile,
  type Story
} from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileIcon } from "../components/mobile-icons";
import { MobileListingTile } from "../components/mobile-listing-tile";
import { MobileSectionHeader } from "../components/mobile-section-header";
import { StoriesRow, StoryCreator, StoryViewer } from "../components/stories";
import { getMobileCategoriesRepository } from "../lib/categories-repository";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { getMobileSellersRepository } from "../lib/sellers-repository";
import { getMobileStoriesRepository } from "../lib/stories-repository";
import { mobileLayout, mobileRadius, mobileSpacing } from "../theme/mobile-theme";

type MarketplaceScreenProps = {
  direction: Direction;
  refreshKey?: number;
  onOpenListing(listing: MarketplaceListing): void;
  onOpenSearch(initialSearch?: string): void;
  onOpenMyAds(): void;
  onOpenAuth?(): void;
  onOpenMap?(): void;
  previewState?: "loading" | "error" | "empty" | "guest";
};

type CityKey = "riyadh" | "jeddah" | "dammam" | "makkah" | "madinah";
type OwnerSummary = { active: number; drafts: number; reserved: number };
type PostedWithinDays = 1 | 7 | 30;

const HOME_LISTINGS_FETCH_SIZE = 120;
const INLINE_RESULTS_PAGE_SIZE = 6;

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

function getCategoryLabel(category: MarketplaceCategoryNode, direction: Direction): string {
  return direction === "rtl" ? category.nameAr : category.nameEn;
}

function flattenLeafCategories(tree: MarketplaceCategoryNode[]): MarketplaceCategoryNode[] {
  const unique = new Map<string, MarketplaceCategoryNode>();
  for (const category of tree) {
    for (const leaf of collectLeafCategories(category)) {
      unique.set(leaf.id, leaf);
    }
  }
  return Array.from(unique.values());
}

function findRootCategoryBySlug(tree: MarketplaceCategoryNode[], slug: ListingsFilters["category"]): MarketplaceCategoryNode | null {
  if (!slug) {
    return null;
  }

  for (const rootCategory of tree) {
    if (collectLeafCategories(rootCategory).some((leaf) => leaf.slug === slug)) {
      return rootCategory;
    }
  }

  return null;
}

function listingMatchesInlineQuery(listing: MarketplaceListing, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length === 0) {
    return true;
  }

  const haystack = [listing.title, listing.description ?? "", listing.locationName ?? "", listing.categorySlug ?? ""].join(" ").toLowerCase();
  return haystack.includes(normalizedQuery);
}

function listingMatchesPostedWithin(listing: MarketplaceListing, days: PostedWithinDays | null): boolean {
  if (!days) {
    return true;
  }

  const createdAt = Date.parse(listing.createdAt);
  if (Number.isNaN(createdAt)) {
    return false;
  }

  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return createdAt >= threshold;
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

export function MarketplaceScreen({ direction, refreshKey, onOpenListing, onOpenSearch, onOpenMyAds, onOpenAuth, onOpenMap, previewState }: MarketplaceScreenProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const sellersRepository = useMemo(() => getMobileSellersRepository(), []);
  const categoriesRepository = useMemo(() => getMobileCategoriesRepository(), []);
  const textAlign = direction === "rtl" ? "right" : "left";
  const isRtl = direction === "rtl";

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const selectedCity: CityKey = "riyadh";
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categoryTree, setCategoryTree] = useState<MarketplaceCategoryNode[]>([]);
  const [sellerMap, setSellerMap] = useState<Map<string, SellerProfile>>(new Map());
  const [recentSearches, setRecentSearches] = useState<StoredSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<StoredSearch[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentViewIds, setRecentViewIds] = useState<string[]>([]);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ListingsFilters | undefined>(undefined);
  const [draftFilters, setDraftFilters] = useState<ListingsFilters | undefined>(undefined);
  const [appliedStatus, setAppliedStatus] = useState<ListingFilterStatus>("all");
  const [draftStatus, setDraftStatus] = useState<ListingFilterStatus>("all");
  const [appliedSort, setAppliedSort] = useState<ListingsQuery["sort"]>("newest");
  const [draftSort, setDraftSort] = useState<ListingsQuery["sort"]>("newest");
  const [appliedPostedWithinDays, setAppliedPostedWithinDays] = useState<PostedWithinDays | null>(null);
  const [draftPostedWithinDays, setDraftPostedWithinDays] = useState<PostedWithinDays | null>(null);
  const [draftCategoryRootId, setDraftCategoryRootId] = useState<string | null>(null);
  const [resultsPage, setResultsPage] = useState(1);

  // ── Stories state ──────────────────────────────────────────────────────────
  const storiesRepository = useMemo(() => getMobileStoriesRepository(), []);
  const [followedStories, setFollowedStories] = useState<FollowedSellerStories[]>([]);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyCreatorVisible, setStoryCreatorVisible] = useState(false);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);

  const selectedCityLabel = t(`siteLayout.cities.${selectedCity}`);
  const filterCityOptions = SEARCH_CITY_KEYS as readonly SearchCityKey[];
  const visibleCategories = useMemo(() => categoryTree.slice(0, 6), [categoryTree]);
  const leafCategories = useMemo(() => flattenLeafCategories(categoryTree), [categoryTree]);
  const selectedDraftCategoryRoot = useMemo(() => {
    if (draftCategoryRootId) {
      return categoryTree.find((category) => category.id === draftCategoryRootId) ?? null;
    }

    return findRootCategoryBySlug(categoryTree, draftFilters?.category);
  }, [categoryTree, draftCategoryRootId, draftFilters?.category]);
  const draftCategoryOptions = useMemo(
    () => (selectedDraftCategoryRoot ? collectLeafCategories(selectedDraftCategoryRoot) : []),
    [selectedDraftCategoryRoot]
  );
  const activeFilterCount = countActiveListingsFilters(appliedFilters) + (appliedStatus !== "all" ? 1 : 0) + (appliedPostedWithinDays ? 1 : 0);
  const draftActiveFilterCount = countActiveListingsFilters(draftFilters) + (draftStatus !== "all" ? 1 : 0) + (draftPostedWithinDays ? 1 : 0);
  const inlineResultsActive = appliedSearch.trim().length > 0 || activeFilterCount > 0 || appliedSort !== "newest";
  useEffect(() => {
    let active = true;
    const query: ListingsQuery = { search: "", status: "all", sort: "newest", page: 1, pageSize: HOME_LISTINGS_FETCH_SIZE };

    if (previewState === "error") {
      setIsLoading(false);
      setError(t("marketplace.loadError"));
      return () => {
        active = false;
      };
    }

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
        setCategoryTree(categoryTree);

        const ownerIds = Array.from(
          new Set(nextListings.map((item) => item.ownerId).filter((ownerId): ownerId is string => typeof ownerId === "string" && ownerId.length > 0))
        ).slice(0, 12);
        const profiles = await Promise.all(ownerIds.map((ownerId) => sellersRepository.getProfile(ownerId, snapshot.user?.id ?? null)));
        if (!active) {
          return;
        }

        setSellerMap(new Map(profiles.filter((profile): profile is SellerProfile => profile !== null).map((profile) => [profile.id, profile] as const)));
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
  }, [categoriesRepository, listingsRepository, previewState, refreshKey, sellersRepository, snapshot.user?.id, t]);

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

  // ── Stories: load followed sellers' stories ────────────────────────────────
  useEffect(() => {
    if (!snapshot.user?.id || previewState === "guest") {
      setFollowedStories([]);
      return;
    }
    let active = true;
    const userId = snapshot.user.id;
    storiesRepository.getFollowedSellersStories(userId).then((result) => {
      if (active) setFollowedStories(result);
    }).catch(() => { /* non-blocking */ });
    return () => { active = false; };
  }, [snapshot.user?.id, previewState, storiesRepository]);

  // ── Stories: load owner's listings for story creator ──────────────────────
  useEffect(() => {
    if (!snapshot.user?.id || !storyCreatorVisible) return;
    let active = true;
    const ownerId = snapshot.user.id;
    listingsRepository
      .listByOwner(ownerId, { search: "", status: "available", sort: "newest", page: 1, pageSize: 50 })
      .then((r) => { if (active) setMyListings(r.items); })
      .catch(() => {});
    return () => { active = false; };
  }, [snapshot.user?.id, storyCreatorVisible, listingsRepository]);

  const handleOpenStory = useCallback((sellerId: string, stories: Story[]) => {
    setViewerStories(stories);
    setStoryViewerVisible(true);
  }, []);

  const handleMarkViewed = useCallback((storyId: string) => {
    if (!snapshot.user?.id) return;
    void storiesRepository.markStoryViewed(storyId, snapshot.user.id);
  }, [snapshot.user?.id, storiesRepository]);

  const handlePublishStory = useCallback(async (params: {
    mediaType: "image" | "video" | "text";
    mediaUri?: string;
    textContent?: string;
    caption?: string;
    attachedListingIds: string[];
  }) => {
    if (!snapshot.user?.id) return;
    const userId = snapshot.user.id;
    await storiesRepository.createStory({
      sellerId: userId,
      media: [{
        mediaType: params.mediaType,
        mediaUrl: params.mediaUri,
        textContent: params.textContent,
        caption: params.caption
      }],
      attachedListingIds: params.attachedListingIds
    });
    // Refresh stories row
    const updated = await storiesRepository.getFollowedSellersStories(userId);
    setFollowedStories(updated);
  }, [snapshot.user?.id, storiesRepository]);

  const sellerActivityCount = (ownerSummary?.active ?? 0) + (ownerSummary?.drafts ?? 0) + (ownerSummary?.reserved ?? 0);
  const buyerSignalCount = recentSearches.length + savedSearches.length + recentViewIds.length + favoriteIds.length;
  const isSellerFocused = sellerActivityCount > Math.max(2, buyerSignalCount) && previewState !== "guest";

  const recentViewedListings = useMemo(() => selectListingsByIds(recentViewIds, listings).slice(0, 4), [listings, recentViewIds]);
  const favoriteListings = useMemo(() => selectListingsByIds(favoriteIds, listings).slice(0, 4), [favoriteIds, listings]);
  const nearbyListings = useMemo(() => listings.filter((listing) => listingMatchesCity(listing, selectedCityLabel)).slice(0, 4), [listings, selectedCityLabel]);
  const personalizedListings = useMemo(() => {
    const sourceSearches = [...savedSearches, ...recentSearches].slice(0, 6);
    const matched = uniqueListings(sourceSearches.flatMap((item) => listings.filter((listing) => listingMatchesSearch(listing, item))));
    if (matched.length > 0) {
      return matched.slice(0, 4);
    }

    return uniqueListings([...recentViewedListings, ...favoriteListings, ...nearbyListings, ...listings]).slice(0, 4);
  }, [favoriteListings, listings, nearbyListings, recentSearches, recentViewedListings, savedSearches]);
  const primarySavedSearch = savedSearches[0] ?? recentSearches[0] ?? null;

  const primaryAssistantCopy = recentViewedListings.length > 0
    ? t("home.hero.assistantContinue")
    : savedSearches.length > 0
      ? t("home.hero.assistantSaved")
      : isSellerFocused
        ? t("home.hero.assistantSeller")
        : nearbyListings.length > 0
          ? t("home.hero.assistantNearby")
          : t("home.hero.assistantDefault");

  const persistSearch = async (storageKey: typeof RECENT_SEARCHES_STORAGE_KEY | typeof SAVED_SEARCHES_STORAGE_KEY, queryValue: string) => {
    const raw = await AsyncStorage.getItem(storageKey);
    const next = upsertStoredSearch(raw, { query: queryValue.trim(), city: selectedCityLabel });
    await AsyncStorage.setItem(storageKey, next.serialized);
    if (storageKey === RECENT_SEARCHES_STORAGE_KEY) {
      setRecentSearches(next.items);
    } else {
      setSavedSearches(next.items);
    }
  };

  const filteredListings = useMemo(() => {
    const nextItems = listings
      .filter((listing) => listingMatchesInlineQuery(listing, appliedSearch))
      .filter((listing) => matchesListingsFilters(listing, appliedFilters))
      .filter((listing) => listingMatchesPostedWithin(listing, appliedPostedWithinDays))
      .filter((listing) => (appliedStatus === "all" ? true : listing.status === appliedStatus));

    nextItems.sort((left, right) => {
      if (appliedSort === "priceHigh") {
        return right.price - left.price || Date.parse(right.createdAt) - Date.parse(left.createdAt);
      }
      if (appliedSort === "priceLow") {
        return left.price - right.price || Date.parse(right.createdAt) - Date.parse(left.createdAt);
      }
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });

    return nextItems;
  }, [appliedFilters, appliedPostedWithinDays, appliedSearch, appliedSort, appliedStatus, listings]);

  const filteredResultsTotalPages = Math.max(1, Math.ceil(filteredListings.length / INLINE_RESULTS_PAGE_SIZE));
  const paginatedFilteredListings = useMemo(() => {
    const from = (resultsPage - 1) * INLINE_RESULTS_PAGE_SIZE;
    return filteredListings.slice(from, from + INLINE_RESULTS_PAGE_SIZE);
  }, [filteredListings, resultsPage]);

  useEffect(() => {
    setResultsPage(1);
  }, [appliedFilters, appliedPostedWithinDays, appliedSearch, appliedSort, appliedStatus]);

  useEffect(() => {
    if (resultsPage > filteredResultsTotalPages) {
      setResultsPage(filteredResultsTotalPages);
    }
  }, [filteredResultsTotalPages, resultsPage]);

  const handleSearchSubmit = useCallback(async (queryValue: string) => {
    const normalizedQuery = queryValue.trim();
    setSearch(queryValue);
    setAppliedSearch(normalizedQuery);
    setResultsPage(1);
    if (normalizedQuery.length > 0) {
      await persistSearch(RECENT_SEARCHES_STORAGE_KEY, normalizedQuery);
    }
  }, [selectedCityLabel]);

  const handleOpenFilters = useCallback(() => {
    setDraftFilters(appliedFilters);
    setDraftStatus(appliedStatus);
    setDraftSort(appliedSort);
    setDraftPostedWithinDays(appliedPostedWithinDays);
    setDraftCategoryRootId(findRootCategoryBySlug(categoryTree, appliedFilters?.category)?.id ?? null);
    setIsFilterSheetVisible(true);
  }, [appliedFilters, appliedPostedWithinDays, appliedSort, appliedStatus, categoryTree]);

  const handleResetDraftFilters = useCallback(() => {
    setDraftFilters(undefined);
    setDraftStatus("all");
    setDraftSort("newest");
    setDraftPostedWithinDays(null);
    setDraftCategoryRootId(null);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(normalizeListingsFilters(draftFilters));
    setAppliedStatus(draftStatus);
    setAppliedSort(draftSort);
    setAppliedPostedWithinDays(draftPostedWithinDays);
    setIsFilterSheetVisible(false);
  }, [draftFilters, draftPostedWithinDays, draftSort, draftStatus]);

  const handleApplyCategoryFilter = useCallback((categorySlug: ListingsFilters["category"]) => {
    setSearch("");
    setAppliedSearch("");
    setAppliedFilters((current) => normalizeListingsFilters({ ...(current ?? {}), category: categorySlug }));
    setResultsPage(1);
  }, []);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove(): void }> = [];
    const category = appliedFilters?.category ? leafCategories.find((item) => item.slug === appliedFilters.category) : null;

    if (appliedSearch.trim().length > 0) {
      chips.push({
        key: "query",
        label: appliedSearch,
        onRemove: () => {
          setSearch("");
          setAppliedSearch("");
        }
      });
    }
    if (category) {
      chips.push({
        key: "category",
        label: getCategoryLabel(category, direction),
        onRemove: () => setAppliedFilters((current) => normalizeListingsFilters({ ...(current ?? {}), category: undefined }))
      });
    }
    if (appliedFilters?.city) {
      chips.push({
        key: "city",
        label: t(`siteLayout.cities.${appliedFilters.city}`),
        onRemove: () => setAppliedFilters((current) => normalizeListingsFilters({ ...(current ?? {}), city: undefined }))
      });
    }
    if (typeof appliedFilters?.minPrice === "number" || typeof appliedFilters?.maxPrice === "number") {
      chips.push({
        key: "price",
        label: `${typeof appliedFilters?.minPrice === "number" ? appliedFilters.minPrice : 0} - ${typeof appliedFilters?.maxPrice === "number" ? appliedFilters.maxPrice : "∞"}`,
        onRemove: () => setAppliedFilters((current) => normalizeListingsFilters({ ...(current ?? {}), minPrice: undefined, maxPrice: undefined }))
      });
    }
    if (appliedStatus !== "all") {
      chips.push({
        key: "status",
        label: t(`marketplace.filters.${appliedStatus}`),
        onRemove: () => setAppliedStatus("all")
      });
    }
    if (appliedPostedWithinDays) {
      const postedWithinKey =
        appliedPostedWithinDays === 1 ? "search.filters.last24Hours" : appliedPostedWithinDays === 7 ? "search.filters.last7Days" : "search.filters.last30Days";
      chips.push({
        key: "postedWithin",
        label: t(postedWithinKey),
        onRemove: () => setAppliedPostedWithinDays(null)
      });
    }
    return chips;
  }, [appliedFilters, appliedPostedWithinDays, appliedSearch, appliedStatus, direction, leafCategories, t]);

  if (previewState === "loading" || isLoading) {
    return <HomePlaceholder />;
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Stories row — top of home screen */}
      <StoriesRow
        direction={direction}
        followedStories={followedStories}
        currentUserId={snapshot.user?.id ?? null}
        onAddStory={() => setStoryCreatorVisible(true)}
        onOpenStory={handleOpenStory}
      />

      <View style={styles.heroCard}>
        <View style={[styles.searchRow, isRtl ? styles.searchRowRtl : undefined]}>
          <View style={[styles.searchShell, isRtl ? styles.searchShellRtl : undefined]}>
            <MobileIcon name="search" size={18} color="#64748b" />
            <TextInput
              style={[styles.searchInput, { textAlign }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t("home.hero.searchPlaceholder")}
              returnKeyType="search"
              onSubmitEditing={() => void handleSearchSubmit(search)}
            />
          </View>
          <Pressable
            onPress={() => {
              if (onOpenMap) onOpenMap();
              else onOpenSearch("");
            }}
            style={styles.searchMapBtn}
          >
            <MobileIcon name="map" size={20} color="#1d4ed8" />
          </Pressable>
        </View>

        <View style={[styles.filtersRow, isRtl ? styles.filtersRowRtl : undefined]}>
          <Pressable style={styles.filterButton} onPress={handleOpenFilters}>
            <MobileIcon name="filter" size={16} color="#0f766e" />
            <Text style={styles.filterButtonLabel}>{t("search.filters.open", { count: activeFilterCount })}</Text>
          </Pressable>
        </View>

        <View style={[styles.signalChips, isRtl ? styles.signalChipsRtl : undefined]}>
          {recentSearches.slice(0, 1).map((item) => (
            <Pressable key={`recent-${item.id}`} style={styles.signalChip} onPress={() => void handleSearchSubmit(item.query)}>
              <Text style={styles.signalChipLabel}>{t("home.search.recentPrefix")} {item.query}</Text>
            </Pressable>
          ))}
          {savedSearches.slice(0, 1).map((item) => (
            <Pressable key={`saved-${item.id}`} style={styles.savedSignalChip} onPress={() => void handleSearchSubmit(item.query)}>
              <Text style={styles.savedSignalChipLabel}>{t("home.search.savedPrefix")} {item.query}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {inlineResultsActive && activeFilterChips.length > 0 ? (
        <View style={[styles.activeFiltersRow, isRtl ? styles.activeFiltersRowRtl : undefined]}>
          {activeFilterChips.map((chip) => (
            <Pressable key={chip.key} style={styles.activeFilterChip} onPress={chip.onRemove}>
              <Text style={styles.activeFilterChipLabel}>{chip.label}</Text>
              <Text style={styles.activeFilterChipClose}>×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {inlineResultsActive ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader
            direction={direction}
            title={t("search.pageTitle")}
            subtitle={t("marketplace.listCount", { count: filteredListings.length })}
            badge={activeFilterCount > 0 ? t("search.filters.activeCount", { count: activeFilterCount }) : undefined}
          />
          {filteredListings.length === 0 ? (
            <View style={styles.inlineEmptyState}>
              <Text style={[styles.emptyTitle, { textAlign }]}>{t("home.empty.title")}</Text>
              <Text style={[styles.emptyHint, { textAlign }]}>{t("marketplace.emptyState")}</Text>
            </View>
          ) : (
            <>
              <View style={[styles.listingGrid, isRtl ? styles.listingGridRtl : undefined]}>
                {paginatedFilteredListings.map((item) => (
                  <MobileListingTile
                    key={`inline-${item.id}`}
                    direction={direction}
                    listing={item}
                    width={mobileLayout.tileWidth}
                    onPress={() => onOpenListing(item)}
                    sellerProfile={item.ownerId ? sellerMap.get(item.ownerId) ?? null : null}
                    insightLabel={activeFilterCount > 0 ? t("search.filters.activeCount", { count: activeFilterCount }) : t("marketplace.sort.label")}
                  />
                ))}
              </View>
              {filteredResultsTotalPages > 1 ? (
                <View style={[styles.inlinePagination, isRtl ? styles.filtersRowRtl : undefined]}>
                  <Pressable
                    style={[styles.inlinePaginationButton, resultsPage <= 1 ? styles.inlinePaginationButtonDisabled : undefined]}
                    disabled={resultsPage <= 1}
                    onPress={() => setResultsPage((current) => Math.max(1, current - 1))}
                  >
                    <Text style={styles.inlinePaginationLabel}>{t("common.previous")}</Text>
                  </Pressable>
                  <Text style={styles.inlinePaginationPage}>{t("common.page", { current: resultsPage, total: filteredResultsTotalPages })}</Text>
                  <Pressable
                    style={[styles.inlinePaginationButton, resultsPage >= filteredResultsTotalPages ? styles.inlinePaginationButtonDisabled : undefined]}
                    disabled={resultsPage >= filteredResultsTotalPages}
                    onPress={() => setResultsPage((current) => Math.min(filteredResultsTotalPages, current + 1))}
                  >
                    <Text style={styles.inlinePaginationLabel}>{t("common.next")}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { textAlign }]}>{t("marketplace.loadError")}</Text>
          <Text style={[styles.errorHint, { textAlign }]}>{error}</Text>
        </View>
      ) : null}

      {savedSearches.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.savedSearches")} subtitle={t("home.sectionDescriptions.savedSearches")} />
          <View style={styles.savedGrid}>
            {savedSearches.slice(0, 3).map((item) => (
              <Pressable key={item.id} style={styles.savedCard} onPress={() => void handleSearchSubmit(item.query)}>
                <Text style={[styles.savedTitle, { textAlign }]}>{item.query}</Text>
                <Text style={[styles.savedHint, { textAlign }]}>{item.city ?? t("home.search.anywhere")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {recentViewedListings.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.recentlyViewed")} subtitle={t("home.sectionDescriptions.recentlyViewed")} />
          <View style={[styles.listingGrid, isRtl ? styles.listingGridRtl : undefined]}>
            {recentViewedListings.map((item) => (
              <MobileListingTile
                key={`recent-${item.id}`}
                direction={direction}
                listing={item}
                width={mobileLayout.tileWidth}
                onPress={() => onOpenListing(item)}
                sellerProfile={item.ownerId ? sellerMap.get(item.ownerId) ?? null : null}
                insightLabel={t("home.card.continue")}
              />
            ))}
          </View>
        </View>
      ) : null}

      {personalizedListings.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.personalized")} subtitle={t("home.sectionDescriptions.personalized")} />
          <View style={[styles.listingGrid, isRtl ? styles.listingGridRtl : undefined]}>
            {personalizedListings.map((item) => (
              <MobileListingTile
                key={`personalized-${item.id}`}
                direction={direction}
                listing={item}
                width={mobileLayout.tileWidth}
                onPress={() => onOpenListing(item)}
                sellerProfile={item.ownerId ? sellerMap.get(item.ownerId) ?? null : null}
                insightLabel={t("home.card.recommended")}
              />
            ))}
          </View>
        </View>
      ) : null}

      {!isSellerFocused && nearbyListings.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.nearby")} subtitle={t("home.sectionDescriptions.nearby", { city: selectedCityLabel })} />
          <View style={[styles.listingGrid, isRtl ? styles.listingGridRtl : undefined]}>
            {nearbyListings.map((item) => (
              <MobileListingTile
                key={`nearby-${item.id}`}
                direction={direction}
                listing={item}
                width={mobileLayout.tileWidth}
                onPress={() => onOpenListing(item)}
                sellerProfile={item.ownerId ? sellerMap.get(item.ownerId) ?? null : null}
                insightLabel={selectedCityLabel}
              />
            ))}
          </View>
        </View>
      ) : null}

      {visibleCategories.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.categories")} subtitle={t("home.sectionDescriptions.categories")} />
          <View style={[styles.categoryGrid, isRtl ? styles.categoryGridRtl : undefined]}>
            {visibleCategories.map((category) => (
              <Pressable
                key={category.id}
                style={styles.categoryCard}
                onPress={() => {
                  const target = resolveCategorySearchTarget(category);
                  handleApplyCategoryFilter(target.slug);
                }}
              >
                <View style={styles.categoryIconBox}>
                  <Text style={styles.categoryEmoji}>{EXPERIENCE_EMOJI[category.experienceKey]}</Text>
                </View>
                <Text style={[styles.categoryTitle, { textAlign }]}>{direction === "rtl" ? category.nameAr : category.nameEn}</Text>
                <Text style={[styles.categoryHint, { textAlign }]}>
                  {collectLeafCategories(category).length || 1} {t("home.categories.childCount")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!error && listings.length === 0 ? (
        <View style={styles.sectionCard}>
          <Text style={[styles.emptyTitle, { textAlign }]}>{t("home.empty.title")}</Text>
          <Text style={[styles.emptyHint, { textAlign }]}>{t("home.empty.description")}</Text>
        </View>
      ) : null}

      {/* Story Viewer */}
      <StoryViewer
        visible={storyViewerVisible}
        stories={viewerStories}
        direction={direction}
        onClose={() => setStoryViewerVisible(false)}
        onMarkViewed={handleMarkViewed}
        onOpenListing={(listing) => {
          setStoryViewerVisible(false);
          onOpenListing(listing);
        }}
      />

      {/* Story Creator */}
      <StoryCreator
        visible={storyCreatorVisible}
        direction={direction}
        myListings={myListings}
        onClose={() => setStoryCreatorVisible(false)}
        onPublish={handlePublishStory}
      />
      </ScrollView>
      <Modal visible={isFilterSheetVisible} transparent animationType="slide" onRequestClose={() => setIsFilterSheetVisible(false)}>
        <View style={styles.filterSheetOverlay}>
          <Pressable style={styles.filterSheetBackdrop} onPress={() => setIsFilterSheetVisible(false)} />
          <View style={styles.filterSheet}>
            <View style={[styles.filterSheetHeader, isRtl ? styles.filterSheetHeaderRtl : undefined]}>
              <View style={styles.filterSheetHeaderCopy}>
                <Text style={[styles.filterSheetTitle, { textAlign }]}>{t("search.filters.title")}</Text>
                <Text style={[styles.filterSheetSubtitle, { textAlign }]}>{t("search.filters.activeCount", { count: draftActiveFilterCount })}</Text>
              </View>
              <Pressable style={styles.filterSheetClose} onPress={() => setIsFilterSheetVisible(false)}>
                <Text style={styles.filterSheetCloseLabel}>{t("common.close")}</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.filterSheetContent} showsVerticalScrollIndicator={false}>
              <View style={styles.filterSectionCard}>
                <View style={styles.filterFieldGroup}>
                  <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.sortBy")}</Text>
                  <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                    {(["newest", "priceLow", "priceHigh"] as const).map((sortKey) => (
                      <Pressable
                        key={sortKey}
                        style={[styles.filterOptionChip, draftSort === sortKey ? styles.filterOptionChipActive : undefined]}
                        onPress={() => setDraftSort(sortKey)}
                      >
                        <Text style={[styles.filterOptionChipLabel, draftSort === sortKey ? styles.filterOptionChipLabelActive : undefined]}>
                          {t(`marketplace.sort.${sortKey}`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.filterSectionCard}>
                <View style={styles.filterFieldGroup}>
                  <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.category")}</Text>
                  <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                    <Pressable
                      style={[styles.filterOptionChip, !draftFilters?.category && !draftCategoryRootId ? styles.filterOptionChipActive : undefined]}
                      onPress={() => {
                        setDraftCategoryRootId(null);
                        setDraftFilters((current) =>
                          normalizeListingsFilters({
                            ...(current ?? {}),
                            category: undefined,
                            brand: undefined,
                            model: undefined,
                            year: undefined,
                            carCondition: undefined,
                            carFuelType: undefined,
                            carAdType: undefined,
                            carPriceMode: undefined
                          })
                        );
                      }}
                    >
                      <Text style={[styles.filterOptionChipLabel, !draftFilters?.category && !draftCategoryRootId ? styles.filterOptionChipLabelActive : undefined]}>
                        {t("search.filters.anyCategory")}
                      </Text>
                    </Pressable>
                    {categoryTree.map((category) => (
                      <Pressable
                        key={category.id}
                        style={[styles.filterOptionChip, draftCategoryRootId === category.id ? styles.filterOptionChipActive : undefined]}
                        onPress={() => {
                          const nextLeafCategories = collectLeafCategories(category);
                          const keepsCurrentCategory = nextLeafCategories.some((leaf) => leaf.slug === draftFilters?.category);
                          setDraftCategoryRootId(category.id);
                          setDraftFilters((current) =>
                            normalizeListingsFilters({
                              ...(current ?? {}),
                              category: keepsCurrentCategory ? current?.category : undefined,
                              brand: keepsCurrentCategory ? current?.brand : undefined,
                              model: keepsCurrentCategory ? current?.model : undefined,
                              year: keepsCurrentCategory ? current?.year : undefined,
                              carCondition: keepsCurrentCategory ? current?.carCondition : undefined,
                              carFuelType: keepsCurrentCategory ? current?.carFuelType : undefined,
                              carAdType: keepsCurrentCategory ? current?.carAdType : undefined,
                              carPriceMode: keepsCurrentCategory ? current?.carPriceMode : undefined
                            })
                          );
                        }}
                      >
                        <Text style={[styles.filterOptionChipLabel, draftCategoryRootId === category.id ? styles.filterOptionChipLabelActive : undefined]}>
                          {`${EXPERIENCE_EMOJI[category.experienceKey]} ${getCategoryLabel(category, direction)}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {selectedDraftCategoryRoot ? (
                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{getCategoryLabel(selectedDraftCategoryRoot, direction)}</Text>
                    <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                      {draftCategoryOptions.map((category) => (
                        <Pressable
                          key={category.id}
                          style={[styles.filterOptionChip, draftFilters?.category === category.slug ? styles.filterOptionChipActive : undefined]}
                          onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), category: category.slug }))}
                        >
                          <Text style={[styles.filterOptionChipLabel, draftFilters?.category === category.slug ? styles.filterOptionChipLabelActive : undefined]}>
                            {getCategoryLabel(category, direction)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.filterSectionCard}>
                <View style={styles.filterFieldGroup}>
                  <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.minPrice")}</Text>
                  <View style={[styles.filterInputRow, isRtl ? styles.filterInputRowRtl : undefined]}>
                    <TextInput
                      keyboardType="number-pad"
                      value={typeof draftFilters?.minPrice === "number" ? String(draftFilters.minPrice) : ""}
                      onChangeText={(value) =>
                        setDraftFilters((current) =>
                          normalizeListingsFilters({
                            ...(current ?? {}),
                            minPrice: value.trim().length > 0 ? Number(value.replace(/[^\d]/g, "")) : undefined
                          })
                        )
                      }
                      style={[styles.filterInput, styles.filterInputHalf, { textAlign }]}
                    />
                    <TextInput
                      keyboardType="number-pad"
                      value={typeof draftFilters?.maxPrice === "number" ? String(draftFilters.maxPrice) : ""}
                      onChangeText={(value) =>
                        setDraftFilters((current) =>
                          normalizeListingsFilters({
                            ...(current ?? {}),
                            maxPrice: value.trim().length > 0 ? Number(value.replace(/[^\d]/g, "")) : undefined
                          })
                        )
                      }
                      style={[styles.filterInput, styles.filterInputHalf, { textAlign }]}
                      placeholder={t("search.filters.maxPrice")}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.filterSectionCard}>
                <View style={styles.filterFieldGroup}>
                  <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.city")}</Text>
                  <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                    <Pressable
                      style={[styles.filterOptionChip, !draftFilters?.city ? styles.filterOptionChipActive : undefined]}
                      onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), city: undefined }))}
                    >
                      <Text style={[styles.filterOptionChipLabel, !draftFilters?.city ? styles.filterOptionChipLabelActive : undefined]}>
                        {t("search.filters.anyCity")}
                      </Text>
                    </Pressable>
                    {filterCityOptions.map((cityKey) => (
                      <Pressable
                        key={cityKey}
                        style={[styles.filterOptionChip, draftFilters?.city === cityKey ? styles.filterOptionChipActive : undefined]}
                        onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), city: cityKey }))}
                      >
                        <Text style={[styles.filterOptionChipLabel, draftFilters?.city === cityKey ? styles.filterOptionChipLabelActive : undefined]}>
                          {t(`siteLayout.cities.${cityKey}`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.filterFieldGroup}>
                  <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.postedWithin")}</Text>
                  <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                    <Pressable
                      style={[styles.filterOptionChip, !draftPostedWithinDays ? styles.filterOptionChipActive : undefined]}
                      onPress={() => setDraftPostedWithinDays(null)}
                    >
                      <Text style={[styles.filterOptionChipLabel, !draftPostedWithinDays ? styles.filterOptionChipLabelActive : undefined]}>
                        {t("search.filters.anyTime")}
                      </Text>
                    </Pressable>
                    {([1, 7, 30] as const).map((days) => {
                      const labelKey = days === 1 ? "search.filters.last24Hours" : days === 7 ? "search.filters.last7Days" : "search.filters.last30Days";
                      return (
                        <Pressable
                          key={days}
                          style={[styles.filterOptionChip, draftPostedWithinDays === days ? styles.filterOptionChipActive : undefined]}
                          onPress={() => setDraftPostedWithinDays(days)}
                        >
                          <Text style={[styles.filterOptionChipLabel, draftPostedWithinDays === days ? styles.filterOptionChipLabelActive : undefined]}>
                            {t(labelKey)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.filterFieldGroup}>
                  <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.status")}</Text>
                  <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                    {(["all", "available", "reserved"] as const).map((status) => (
                      <Pressable
                        key={status}
                        style={[styles.filterOptionChip, draftStatus === status ? styles.filterOptionChipActive : undefined]}
                        onPress={() => setDraftStatus(status)}
                      >
                        <Text style={[styles.filterOptionChipLabel, draftStatus === status ? styles.filterOptionChipLabelActive : undefined]}>
                          {t(`marketplace.filters.${status}`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {isCarCategory(draftFilters?.category) ? (
                <View style={styles.filterSectionCard}>
                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.brand")}</Text>
                    <TextInput
                      value={draftFilters?.brand ?? ""}
                      onChangeText={(value) => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), brand: value || undefined }))}
                      style={[styles.filterInput, { textAlign }]}
                    />
                  </View>
                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.model")}</Text>
                    <TextInput
                      value={draftFilters?.model ?? ""}
                      onChangeText={(value) => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), model: value || undefined }))}
                      style={[styles.filterInput, { textAlign }]}
                    />
                  </View>
                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.year")}</Text>
                    <TextInput
                      keyboardType="number-pad"
                      value={draftFilters?.year ?? ""}
                      onChangeText={(value) => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), year: value || undefined }))}
                      style={[styles.filterInput, { textAlign }]}
                    />
                  </View>

                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.condition")}</Text>
                    <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                      <Pressable
                        style={[styles.filterOptionChip, !draftFilters?.carCondition ? styles.filterOptionChipActive : undefined]}
                        onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carCondition: undefined }))}
                      >
                        <Text style={[styles.filterOptionChipLabel, !draftFilters?.carCondition ? styles.filterOptionChipLabelActive : undefined]}>
                          {t("search.filters.anyCondition")}
                        </Text>
                      </Pressable>
                      {CAR_CONDITIONS.map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.filterOptionChip, draftFilters?.carCondition === option ? styles.filterOptionChipActive : undefined]}
                          onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carCondition: option }))}
                        >
                          <Text style={[styles.filterOptionChipLabel, draftFilters?.carCondition === option ? styles.filterOptionChipLabelActive : undefined]}>
                            {t(`marketplace.create.carDetails.conditionOptions.${option}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.fuel")}</Text>
                    <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                      <Pressable
                        style={[styles.filterOptionChip, !draftFilters?.carFuelType ? styles.filterOptionChipActive : undefined]}
                        onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carFuelType: undefined }))}
                      >
                        <Text style={[styles.filterOptionChipLabel, !draftFilters?.carFuelType ? styles.filterOptionChipLabelActive : undefined]}>
                          {t("search.filters.anyFuel")}
                        </Text>
                      </Pressable>
                      {CAR_FUEL_TYPES.map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.filterOptionChip, draftFilters?.carFuelType === option ? styles.filterOptionChipActive : undefined]}
                          onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carFuelType: option }))}
                        >
                          <Text style={[styles.filterOptionChipLabel, draftFilters?.carFuelType === option ? styles.filterOptionChipLabelActive : undefined]}>
                            {t(`marketplace.create.carDetails.fuelOptions.${option}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.adType")}</Text>
                    <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                      <Pressable
                        style={[styles.filterOptionChip, !draftFilters?.carAdType ? styles.filterOptionChipActive : undefined]}
                        onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carAdType: undefined }))}
                      >
                        <Text style={[styles.filterOptionChipLabel, !draftFilters?.carAdType ? styles.filterOptionChipLabelActive : undefined]}>
                          {t("search.filters.anyAdType")}
                        </Text>
                      </Pressable>
                      {CAR_AD_TYPES.map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.filterOptionChip, draftFilters?.carAdType === option ? styles.filterOptionChipActive : undefined]}
                          onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carAdType: option }))}
                        >
                          <Text style={[styles.filterOptionChipLabel, draftFilters?.carAdType === option ? styles.filterOptionChipLabelActive : undefined]}>
                            {t(`marketplace.create.carDetails.adTypeOptions.${option}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.filterFieldGroup}>
                    <Text style={[styles.filterFieldLabel, { textAlign }]}>{t("search.filters.priceMode")}</Text>
                    <View style={[styles.filterOptionWrap, isRtl ? styles.filterOptionWrapRtl : undefined]}>
                      <Pressable
                        style={[styles.filterOptionChip, !draftFilters?.carPriceMode ? styles.filterOptionChipActive : undefined]}
                        onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carPriceMode: undefined }))}
                      >
                        <Text style={[styles.filterOptionChipLabel, !draftFilters?.carPriceMode ? styles.filterOptionChipLabelActive : undefined]}>
                          {t("search.filters.anyPriceMode")}
                        </Text>
                      </Pressable>
                      {CAR_PRICE_MODES.map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.filterOptionChip, draftFilters?.carPriceMode === option ? styles.filterOptionChipActive : undefined]}
                          onPress={() => setDraftFilters((current) => normalizeListingsFilters({ ...(current ?? {}), carPriceMode: option }))}
                        >
                          <Text style={[styles.filterOptionChipLabel, draftFilters?.carPriceMode === option ? styles.filterOptionChipLabelActive : undefined]}>
                            {t(`marketplace.create.carDetails.priceModeOptions.${option}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View style={[styles.filterSheetFooter, isRtl ? styles.filterSheetHeaderRtl : undefined]}>
              <Pressable style={styles.filterSecondaryButton} onPress={handleResetDraftFilters}>
                <Text style={styles.filterSecondaryButtonLabel}>{t("search.filters.clearAll")}</Text>
              </Pressable>
              <Pressable style={styles.filterPrimaryButton} onPress={handleApplyFilters}>
                <Text style={styles.filterPrimaryButtonLabel}>{t("search.filters.apply")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: mobileLayout.sectionGap,
    paddingTop: mobileLayout.screenPaddingTop,
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingBottom: mobileLayout.screenPaddingBottom
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
    height: 112,
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
    borderRadius: mobileRadius.lg,
    backgroundColor: "#f7fbfd",
    padding: mobileSpacing.md
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0f766e",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  welcomeText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#64748b"
  },
  pageSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: "#475569"
  },
  searchRow: {
    marginTop: mobileSpacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  searchRowRtl: {
    flexDirection: "row-reverse"
  },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: mobileSpacing.sm
  },
  searchShellRtl: {
    flexDirection: "row-reverse"
  },
  searchInput: {
    flex: 1,
    paddingVertical: mobileSpacing.sm,
    fontSize: 14,
    color: "#0f172a"
  },
  searchMapBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#eff6ff"
  },
  filtersRow: {
    marginTop: mobileSpacing.sm,
    flexDirection: "row"
  },
  filtersRowRtl: {
    flexDirection: "row-reverse"
  },
  filterButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cfe9e4",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  filterButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  activeFiltersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs
  },
  activeFiltersRowRtl: {
    flexDirection: "row-reverse"
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
  },
  activeFilterChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8"
  },
  activeFilterChipClose: {
    fontSize: 14,
    lineHeight: 14,
    color: "#1d4ed8"
  },
  signalChips: {
    marginTop: mobileSpacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs
  },
  signalChipsRtl: {
    flexDirection: "row-reverse"
  },
  signalChip: {
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
  },
  signalChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569"
  },
  savedSignalChip: {
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
  },
  savedSignalChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857"
  },
  nextActionsGrid: {
    flexDirection: "row",
    gap: 10
  },
  nextActionCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 16
  },
  nextActionCardPrimary: {
    backgroundColor: "#f0fdfa"
  },
  nextActionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a"
  },
  nextActionDescription: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  },
  errorBox: {
    borderRadius: mobileRadius.md,
    backgroundColor: "#fef2f2",
    padding: mobileLayout.cardPadding
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
    borderRadius: mobileRadius.lg,
    backgroundColor: "#ffffff",
    padding: mobileLayout.cardPadding
  },
  ownerGrid: {
    marginTop: mobileSpacing.sm,
    flexDirection: "row",
    gap: mobileSpacing.xs
  },
  ownerMetricCard: {
    flex: 1,
    borderRadius: mobileRadius.md,
    padding: mobileLayout.cardPadding
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
  savedGrid: {
    marginTop: mobileSpacing.sm,
    gap: mobileSpacing.xs
  },
  savedCard: {
    borderRadius: mobileRadius.md,
    backgroundColor: "#f8fafc",
    padding: mobileLayout.cardPadding
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
  inlineEmptyState: {
    marginTop: mobileSpacing.sm
  },
  listingGrid: {
    marginTop: mobileSpacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileLayout.gridGap
  },
  listingGridRtl: {
    flexDirection: "row-reverse"
  },
  inlinePagination: {
    marginTop: mobileSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.xs
  },
  inlinePaginationButton: {
    borderRadius: mobileRadius.md,
    backgroundColor: "#ecfdfa",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
  },
  inlinePaginationButtonDisabled: {
    opacity: 0.45
  },
  inlinePaginationLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  inlinePaginationPage: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    textAlign: "center"
  },
  categoryGrid: {
    marginTop: mobileSpacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileLayout.gridGap
  },
  categoryGridRtl: {
    flexDirection: "row-reverse"
  },
  categoryCard: {
    width: mobileLayout.tileWidth,
    borderRadius: mobileRadius.md,
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
    padding: mobileLayout.cardPadding
  },
  categoryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  categoryEmoji: {
    fontSize: 26
  },
  categoryTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  categoryHint: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
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
  },
  filterSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.25)"
  },
  filterSheetBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  filterSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: mobileRadius.lg,
    borderTopRightRadius: mobileRadius.lg,
    backgroundColor: "#ffffff",
    paddingTop: mobileSpacing.md
  },
  filterSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingBottom: mobileSpacing.sm
  },
  filterSheetHeaderRtl: {
    flexDirection: "row-reverse"
  },
  filterSheetHeaderCopy: {
    flex: 1
  },
  filterSheetTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a"
  },
  filterSheetSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b"
  },
  filterSheetClose: {
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
  },
  filterSheetCloseLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  filterSheetContent: {
    gap: mobileSpacing.md,
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingBottom: mobileSpacing.lg
  },
  filterSectionCard: {
    gap: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: "#f8fafc",
    padding: mobileLayout.cardPadding
  },
  filterFieldGroup: {
    gap: mobileSpacing.xs
  },
  filterFieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a"
  },
  filterInput: {
    minHeight: 42,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.sm,
    fontSize: 14,
    color: "#0f172a"
  },
  filterInputRow: {
    flexDirection: "row",
    gap: mobileSpacing.xs
  },
  filterInputRowRtl: {
    flexDirection: "row-reverse"
  },
  filterInputHalf: {
    flex: 1
  },
  filterOptionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs
  },
  filterOptionWrapRtl: {
    flexDirection: "row-reverse"
  },
  filterOptionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
  },
  filterOptionChipActive: {
    borderColor: "#14b8a6",
    backgroundColor: "#ccfbf1"
  },
  filterOptionChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  filterOptionChipLabelActive: {
    color: "#0f766e"
  },
  filterSheetFooter: {
    flexDirection: "row",
    gap: mobileSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md
  },
  filterSecondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: mobileSpacing.sm
  },
  filterSecondaryButtonLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569"
  },
  filterPrimaryButton: {
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#0f766e",
    paddingHorizontal: 14,
    paddingVertical: mobileSpacing.sm
  },
  filterPrimaryButtonLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff"
  }
});
