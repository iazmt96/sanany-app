import { useEffect, useMemo, useState } from "react";
import { FlatList, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type {
  MarketplaceListing,
  PaginatedResult,
  SellerProfile,
  SellerProfileListingsSort,
  SellerProfileListingsTab,
  SellerRating,
  Story,
  StoryHighlight
} from "@sanany/types";
import { formatMonthYear, formatRelativeTime } from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileIcon } from "../components/mobile-icons";
import { MobileListingCard } from "../components/mobile-listing-card";
import { MobileSectionHeader } from "../components/mobile-section-header";
import { HighlightsRow, StoryViewer } from "../components/stories";
import { getMobileSellersRepository } from "../lib/sellers-repository";
import { getMobileStoriesRepository } from "../lib/stories-repository";
import { resolveListingPriceLabel } from "../lib/listing-price-label";

type SellerProfileScreenProps = {
  direction: Direction;
  sellerId: string;
  onBack(): void;
  onOpenListing(listing: MarketplaceListing): void;
};

type ProfileTab = "all" | "available" | "sold" | "ratings";

const PAGE_SIZE = 8;

function getRatingStars(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  const full = Math.floor(rounded);
  const half = rounded % 1 !== 0;
  const empty = 5 - full - (half ? 1 : 0);
  return `${"★".repeat(full)}${half ? "☆" : ""}${"·".repeat(Math.max(0, empty))}`;
}

export function SellerProfileScreen({ direction, sellerId, onBack, onOpenListing }: SellerProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const repository = useMemo(() => getMobileSellersRepository(), []);
  const storiesRepository = useMemo(() => getMobileStoriesRepository(), []);
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
  const [activeTab, setActiveTab] = useState<ProfileTab>("all");
  const [sort, setSort] = useState<SellerProfileListingsSort>("newest");
  const [ratingsSort, setRatingsSort] = useState<"newest" | "highest" | "lowest">("newest");
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [listingsData, setListingsData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });
  const [ratingsData, setRatingsData] = useState<PaginatedResult<SellerRating>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });
  const [highlights, setHighlights] = useState<StoryHighlight[]>([]);
  const [highlightViewerStories, setHighlightViewerStories] = useState<Story[]>([]);
  const [highlightViewerVisible, setHighlightViewerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [activeTab, sort, ratingsSort]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const viewerId = snapshot.user?.id ?? null;
    const listingsTab: SellerProfileListingsTab =
      activeTab === "ratings" ? "all" : activeTab === "sold" ? "sold" : activeTab === "available" ? "available" : "all";

    void Promise.all([
      repository.getProfile(sellerId, viewerId),
      repository.listSellerListings({ sellerId, viewerId, tab: listingsTab, sort, page, pageSize: PAGE_SIZE }),
      repository.listSellerRatings({ sellerId, sort: ratingsSort, page, pageSize: PAGE_SIZE })
    ])
      .then(([profileResult, listingsResult, ratingsResult]) => {
        if (!active) {
          return;
        }
        setProfile(profileResult);
        setListingsData(listingsResult);
        setRatingsData(ratingsResult);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("sellerProfile.errorLoad"));
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
  }, [activeTab, page, ratingsSort, repository, sellerId, snapshot.user?.id, sort, t]);

  useEffect(() => {
    let active = true;
    void storiesRepository.getSellerHighlights(sellerId).then((result) => {
      if (active) setHighlights(result);
    });
    return () => { active = false; };
  }, [sellerId, storiesRepository]);

  const onOpenHighlight = async (highlight: StoryHighlight) => {
    const stories = await storiesRepository.getHighlightStories(highlight.id, snapshot.user?.id ?? null);
    if (stories.length > 0) {
      setHighlightViewerStories(stories);
      setHighlightViewerVisible(true);
    }
  };

  const onShare = async () => {
    if (!profile) {
      return;
    }
    const profileLink = `sanany://seller/${profile.id}`;
    await Share.share({ message: profileLink, title: profile.displayName, url: profileLink });
  };

  const onCall = async () => {
    if (!profile?.phone || !profile.canShowPhone) {
      setActionMessage(t("sellerProfile.phoneUnavailable"));
      return;
    }
    await Linking.openURL(`tel:${profile.phone}`);
  };

  const onFollowToggle = async () => {
    if (!snapshot.user?.id || !profile || profile.isOwner || isActionLoading) {
      return;
    }

    setIsActionLoading(true);
    setError(null);
    const nextFollow = !profile.isFollowing;
    const previous = profile;

    setProfile({
      ...previous,
      isFollowing: nextFollow,
      followersCount: Math.max(0, previous.followersCount + (nextFollow ? 1 : -1))
    });

    try {
      await repository.setFollow(profile.id, snapshot.user.id, nextFollow);
      setActionMessage(nextFollow ? t("sellerProfile.followSuccess") : t("sellerProfile.unfollowSuccess"));
    } catch (followError) {
      setProfile(previous);
      setError(followError instanceof Error ? followError.message : t("sellerProfile.followFailed"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const joinedAtLabel =
    profile?.joinedAt ? formatMonthYear(profile.joinedAt, locale, "-") : "-";
  const lastSeenLabel =
    profile?.canShowLastSeen && profile.lastSeenAt
      ? formatRelativeTime(profile.lastSeenAt, locale)
      : null;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, isRtl ? styles.rowRtl : undefined]}>
        <Pressable style={[styles.iconButton, isRtl ? styles.iconButtonRtl : undefined]} onPress={onBack}>
          <MobileIcon name="chevron" size={18} color="#334155" />
          <Text style={styles.iconButtonLabel}>{t("sellerProfile.back")}</Text>
        </Pressable>
        <View style={[styles.topActions, isRtl ? styles.rowRtl : undefined]}>
          <Pressable style={styles.iconOnlyButton} onPress={() => void onShare()}>
            <MobileIcon name="share" size={16} color="#0f766e" />
          </Pressable>
          <Pressable style={styles.iconOnlyButton}>
            <MobileIcon name="report" size={16} color="#c2410c" />
          </Pressable>
        </View>
      </View>

      <MobileSectionHeader direction={direction} title={t("sellerProfile.pageTitle")} subtitle={t("sellerProfile.pageSubtitle")} />

      {isLoading ? <Text style={[styles.infoText, { textAlign }]}>{t("common.loading")}</Text> : null}
      {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}
      {!isLoading && !error && !profile ? <Text style={[styles.infoText, { textAlign }]}>{t("sellerProfile.notFound")}</Text> : null}

      {profile ? (
        <>
          <View style={styles.profileCard}>
            <View style={[styles.profileHead, isRtl ? styles.rowRtl : undefined]}>
              <View style={styles.avatar}>
                <MobileIcon name="profile" size={28} color="#0f766e" focused />
              </View>
              <View style={styles.profileMeta}>
                <View style={[styles.nameRow, isRtl ? styles.rowRtl : undefined]}>
                  <Text style={[styles.profileName, { textAlign }]} numberOfLines={1}>
                    {profile.displayName}
                  </Text>
                  {profile.isVerified ? <Text style={styles.verifiedBadge}>{t("sellerProfile.verifiedShort")}</Text> : null}
                </View>
                <Text style={[styles.profileHandle, { textAlign }]}>{profile.username ? `@${profile.username}` : `#${profile.id.slice(0, 8)}`}</Text>
                <Text style={[styles.profileInfo, { textAlign }]}>
                  {t(`sellerProfile.accountType.${profile.accountType}`)} • {profile.city ?? t("sellerProfile.unknownCity")} • {t("sellerProfile.memberSince", { value: joinedAtLabel })}
                </Text>
                {profile.accountType === "company" && profile.companyBusinessType ? (
                  <Text style={[styles.profileInfo, { textAlign }]}>
                    {t("sellerProfile.companyBusinessType", { value: profile.companyBusinessType })}
                  </Text>
                ) : null}
                {lastSeenLabel ? <Text style={[styles.profileInfo, { textAlign }]}>{t("sellerProfile.lastSeen", { value: lastSeenLabel })}</Text> : null}
              </View>
            </View>

            {profile.bio ? <Text style={[styles.bio, { textAlign }]}>{profile.bio}</Text> : null}

            <View style={[styles.ratingRow, isRtl ? styles.rowRtl : undefined]}>
              <Text style={styles.ratingValue}>{profile.ratingAverage.toFixed(1)}</Text>
              <Text style={styles.ratingStars}>{getRatingStars(profile.ratingAverage)}</Text>
              <Text style={styles.ratingCount}>{t("sellerProfile.ratingCount", { count: profile.ratingCount })}</Text>
            </View>

            <View style={styles.statsRow}>
              <Pressable style={styles.statCell}>
                <Text style={styles.statValue}>{profile.listingsCount}</Text>
                <Text style={styles.statLabel}>{t("sellerProfile.stats.listings")}</Text>
              </Pressable>
              <Pressable style={styles.statCell}>
                <Text style={styles.statValue}>{profile.soldListingsCount}</Text>
                <Text style={styles.statLabel}>{t("sellerProfile.stats.sold")}</Text>
              </Pressable>
              <Pressable style={styles.statCell}>
                <Text style={styles.statValue}>{profile.followersCount}</Text>
                <Text style={styles.statLabel}>{t("sellerProfile.stats.followers")}</Text>
              </Pressable>
              <Pressable style={styles.statCell}>
                <Text style={styles.statValue}>{profile.followingCount}</Text>
                <Text style={styles.statLabel}>{t("sellerProfile.stats.following")}</Text>
              </Pressable>
              <Pressable style={styles.statCell}>
                <Text style={styles.statValue}>{profile.ratingCount}</Text>
                <Text style={styles.statLabel}>{t("sellerProfile.stats.ratings")}</Text>
              </Pressable>
            </View>

            <View style={[styles.actionRow, isRtl ? styles.rowRtl : undefined]}>
              {profile.isOwner ? (
                <Pressable style={[styles.actionButton, styles.actionPrimary]}>
                  <Text style={styles.actionPrimaryLabel}>{t("sellerProfile.editProfile")}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable style={[styles.actionButton, styles.actionPrimary, isActionLoading ? styles.disabled : undefined]} onPress={() => void onFollowToggle()}>
                    <Text style={styles.actionPrimaryLabel}>{profile.isFollowing ? t("sellerProfile.unfollow") : t("sellerProfile.follow")}</Text>
                  </Pressable>
                  <Pressable style={styles.actionButton}>
                    <Text style={styles.actionDefaultLabel}>{t("sellerProfile.message")}</Text>
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => void onCall()}>
                    <Text style={styles.actionDefaultLabel}>{t("sellerProfile.call")}</Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.actionButton} onPress={() => void onShare()}>
                <Text style={styles.actionDefaultLabel}>{t("sellerProfile.share")}</Text>
              </Pressable>
            </View>
          </View>

          {highlights.length > 0 && (
            <View style={styles.highlightsWrapper}>
              <HighlightsRow
                highlights={highlights}
                onOpenHighlight={(hl) => void onOpenHighlight(hl)}
              />
            </View>
          )}

          <View style={[styles.tabsRow, isRtl ? styles.rowRtl : undefined]}>
            {(["all", "available", "sold", "ratings"] as const).map((tabKey) => (
              <Pressable key={tabKey} style={[styles.tabButton, activeTab === tabKey ? styles.tabButtonActive : undefined]} onPress={() => setActiveTab(tabKey)}>
                <Text style={[styles.tabLabel, activeTab === tabKey ? styles.tabLabelActive : undefined]}>{t(`sellerProfile.tabs.${tabKey}`)}</Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "ratings" ? (
            <>
              <Pressable
                style={styles.controlButton}
                onPress={() => {
                  const next = ratingsSort === "newest" ? "highest" : ratingsSort === "highest" ? "lowest" : "newest";
                  setRatingsSort(next);
                }}
              >
                <Text style={styles.controlButtonLabel}>{t(`sellerProfile.sortRatings.${ratingsSort}`)}</Text>
              </Pressable>
              {ratingsData.items.length === 0 ? (
                <Text style={[styles.infoText, { textAlign }]}>{t("sellerProfile.noRatings")}</Text>
              ) : (
                <FlatList
                  data={ratingsData.items}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <View style={styles.ratingCard}>
                      <Text style={[styles.ratingCardTitle, { textAlign }]}>{item.raterName ?? t("sellerProfile.anonymousRater")}</Text>
                      <Text style={[styles.ratingCardStars, { textAlign }]}>{getRatingStars(item.rating)}</Text>
                      {item.comment ? <Text style={[styles.ratingCardComment, { textAlign }]}>{item.comment}</Text> : null}
                    </View>
                  )}
                />
              )}
            </>
          ) : (
            <>
              <Pressable
                style={styles.controlButton}
                onPress={() => {
                  const next = sort === "newest" ? "oldest" : sort === "oldest" ? "priceLow" : sort === "priceLow" ? "priceHigh" : "newest";
                  setSort(next);
                }}
              >
                <Text style={styles.controlButtonLabel}>{t(`sellerProfile.sortListings.${sort}`)}</Text>
              </Pressable>
              {listingsData.items.length === 0 ? (
                <Text style={[styles.infoText, { textAlign }]}>{profile.isOwner ? t("sellerProfile.emptyMyListings") : t("sellerProfile.emptyListings")}</Text>
              ) : (
                <FlatList
                  data={listingsData.items}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => onOpenListing(item)}>
                      <MobileListingCard
                        direction={direction}
                        listing={item}
                        priceLabel={resolveListingPriceLabel(item, t)}
                        statusLabel={t(`marketplace.status.${item.status}`)}
                        locationFallback={t("marketplace.detail.approximateLocation")}
                      />
                    </Pressable>
                  )}
                />
              )}
            </>
          )}

          {actionMessage ? <Text style={[styles.infoText, { textAlign }]}>{actionMessage}</Text> : null}
        </>
      ) : null}

      <StoryViewer
        visible={highlightViewerVisible}
        stories={highlightViewerStories}
        direction={direction}
        onClose={() => setHighlightViewerVisible(false)}
        onMarkViewed={() => {}}
        onOpenListing={onOpenListing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  highlightsWrapper: {
    marginTop: 8,
    marginHorizontal: -16
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  iconButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  iconButtonRtl: {
    flexDirection: "row-reverse"
  },
  iconButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  iconOnlyButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  profileCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ecfdfa",
    alignItems: "center",
    justifyContent: "center"
  },
  profileMeta: {
    flex: 1,
    gap: 2
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  verifiedBadge: {
    fontSize: 10,
    color: "#0f766e",
    backgroundColor: "#ecfdfa",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  profileHandle: {
    fontSize: 12,
    color: "#0f766e"
  },
  profileInfo: {
    fontSize: 11,
    color: "#64748b"
  },
  bio: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  ratingStars: {
    fontSize: 13,
    color: "#f59e0b"
  },
  ratingCount: {
    fontSize: 12,
    color: "#64748b"
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 4
  },
  statCell: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f766e"
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748b"
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  actionButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  actionPrimary: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e"
  },
  actionPrimaryLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  actionDefaultLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700"
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  tabButtonActive: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdfa"
  },
  tabLabel: {
    fontSize: 12,
    color: "#475569"
  },
  tabLabelActive: {
    color: "#0f766e",
    fontWeight: "700"
  },
  controlButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  controlButtonLabel: {
    fontSize: 12,
    color: "#0f766e",
    fontWeight: "700"
  },
  listContent: {
    gap: 10,
    paddingBottom: 10
  },
  ratingCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    gap: 4
  },
  ratingCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a"
  },
  ratingCardStars: {
    fontSize: 12,
    color: "#f59e0b"
  },
  ratingCardComment: {
    fontSize: 12,
    color: "#475569"
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c"
  },
  infoText: {
    fontSize: 12,
    color: "#475569"
  },
  disabled: {
    opacity: 0.6
  }
});
