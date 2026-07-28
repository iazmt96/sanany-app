import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  RECENT_SEARCHES_STORAGE_KEY,
  SAVED_SEARCHES_STORAGE_KEY,
  collectLeafCategories,
  parseStoredIdList,
  parseStoredSearches,
  resolveCategorySearchTarget,
  upsertStoredSearch,
  type StoredSearch
} from "@sanany/shared";
import type { FollowedSellerStories, ListingsQuery, MarketplaceCategoryNode, MarketplaceListing, SellerProfile, Story } from "@sanany/types";
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

type MarketplaceScreenProps = {
  direction: Direction;
  onOpenListing(listing: MarketplaceListing): void;
  onOpenSearch(initialSearch?: string): void;
  onOpenMyAds(): void;
  onOpenAuth?(): void;
  onOpenMap?(): void;
  previewState?: "loading" | "error" | "empty" | "guest";
};

type CityKey = "riyadh" | "jeddah" | "dammam" | "makkah" | "madinah";
type OwnerSummary = { active: number; drafts: number; reserved: number };

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

export function MarketplaceScreen({ direction, onOpenListing, onOpenSearch, onOpenMyAds, onOpenAuth, onOpenMap, previewState }: MarketplaceScreenProps) {
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
  const [recentSearches, setRecentSearches] = useState<StoredSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<StoredSearch[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentViewIds, setRecentViewIds] = useState<string[]>([]);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);

  // ── Stories state ──────────────────────────────────────────────────────────
  const storiesRepository = useMemo(() => getMobileStoriesRepository(), []);
  const [followedStories, setFollowedStories] = useState<FollowedSellerStories[]>([]);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyCreatorVisible, setStoryCreatorVisible] = useState(false);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);

  const selectedCityLabel = t(`siteLayout.cities.${selectedCity}`);

  useEffect(() => {
    let active = true;
    const query: ListingsQuery = { search: "", status: "all", sort: "newest", page: 1, pageSize: 80 };

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
        setCategories(categoryTree.slice(0, 6));

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

  if (previewState === "loading" || isLoading) {
    return <HomePlaceholder />;
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Stories row — top of home screen */}
      <StoriesRow
        direction={direction}
        followedStories={followedStories}
        currentUserId={snapshot.user?.id ?? null}
        onAddStory={() => setStoryCreatorVisible(true)}
        onOpenStory={handleOpenStory}
      />

      {/* Quick action tabs — visible immediately at top */}
      <View style={[styles.quickTabsRow, isRtl ? styles.quickTabsRowRtl : undefined]}>
        <Pressable
          style={[styles.quickTab, styles.quickTabAuth]}
          onPress={() => {
            if (previewState === "guest" || !snapshot.user) {
              onOpenAuth?.();
            } else {
              onOpenMyAds();
            }
          }}
        >
          <MobileIcon name="person" size={20} color="#0f766e" />
          <Text style={[styles.quickTabLabel, styles.quickTabAuthLabel]}>
            {previewState === "guest" || !snapshot.user ? t("home.quickTabs.login") : t("home.quickTabs.myAccount")}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.quickTab, styles.quickTabMap]}
          onPress={() => {
            if (onOpenMap) {
              onOpenMap();
            } else {
              onOpenSearch("");
            }
          }}
        >
          <MobileIcon name="map" size={20} color="#1d4ed8" />
          <Text style={[styles.quickTabLabel, styles.quickTabMapLabel]}>{t("home.quickTabs.mapSearch")}</Text>
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <Text style={[styles.pageTitle, { textAlign }]}>{t("home.hero.title")}</Text>
        <Text style={[styles.pageSubtitle, { textAlign }]}>{primaryAssistantCopy}</Text>

        <View style={[styles.searchShell, isRtl ? styles.searchShellRtl : undefined]}>
          <MobileIcon name="search" size={18} color="#64748b" />
          <TextInput style={[styles.searchInput, { textAlign }]} value={search} onChangeText={setSearch} placeholder={t("home.hero.searchPlaceholder")} />
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

        <View style={[styles.signalChips, isRtl ? styles.signalChipsRtl : undefined]}>
          {recentSearches.slice(0, 1).map((item) => (
            <Pressable key={`recent-${item.id}`} style={styles.signalChip} onPress={() => onOpenSearch(item.query)}>
              <Text style={styles.signalChipLabel}>{t("home.search.recentPrefix")} {item.query}</Text>
            </Pressable>
          ))}
          {savedSearches.slice(0, 1).map((item) => (
            <Pressable key={`saved-${item.id}`} style={styles.savedSignalChip} onPress={() => onOpenSearch(item.query)}>
              <Text style={styles.savedSignalChipLabel}>{t("home.search.savedPrefix")} {item.query}</Text>
            </Pressable>
          ))}
        </View>
      </View>

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
              <Pressable key={item.id} style={styles.savedCard} onPress={() => onOpenSearch(item.query)}>
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
          <View style={styles.listingGrid}>
            {recentViewedListings.map((item) => (
              <MobileListingTile
                key={`recent-${item.id}`}
                direction={direction}
                listing={item}
                width="48.5%"
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
          <View style={styles.listingGrid}>
            {personalizedListings.map((item) => (
              <MobileListingTile
                key={`personalized-${item.id}`}
                direction={direction}
                listing={item}
                width="48.5%"
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
          <View style={styles.listingGrid}>
            {nearbyListings.map((item) => (
              <MobileListingTile
                key={`nearby-${item.id}`}
                direction={direction}
                listing={item}
                width="48.5%"
                onPress={() => onOpenListing(item)}
                sellerProfile={item.ownerId ? sellerMap.get(item.ownerId) ?? null : null}
                insightLabel={selectedCityLabel}
              />
            ))}
          </View>
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.sectionCard}>
          <MobileSectionHeader direction={direction} title={t("home.sections.categories")} subtitle={t("home.sectionDescriptions.categories")} />
          <View style={[styles.categoryGrid, isRtl ? styles.categoryGridRtl : undefined]}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={styles.categoryCard}
                onPress={() => {
                  const target = resolveCategorySearchTarget(category);
                  onOpenSearch(direction === "rtl" ? target.nameAr : target.nameEn);
                }}
              >
                <Text style={styles.categoryEmoji}>{EXPERIENCE_EMOJI[category.experienceKey]}</Text>
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
  );
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
    borderRadius: 30,
    backgroundColor: "#f7fbfd",
    padding: 18
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
  pageTitle: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
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
  searchMapBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#eff6ff"
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
  signalChips: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  signalChipsRtl: {
    flexDirection: "row-reverse"
  },
  signalChip: {
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8
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
    paddingVertical: 8
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
  quickTabsRow: {
    flexDirection: "row",
    gap: 10
  },
  quickTabsRowRtl: {
    flexDirection: "row-reverse"
  },
  quickTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 14
  },
  quickTabAuth: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1.5,
    borderColor: "#99f6e4"
  },
  quickTabMap: {
    backgroundColor: "#eff6ff",
    borderWidth: 1.5,
    borderColor: "#bfdbfe"
  },
  quickTabLabel: {
    fontSize: 14,
    fontWeight: "800"
  },
  quickTabAuthLabel: {
    color: "#0f766e"
  },
  quickTabMapLabel: {
    color: "#1d4ed8"
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
  }
});
