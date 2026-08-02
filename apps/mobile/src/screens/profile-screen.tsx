import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getProfileCompletionPercentage, formatMonthYear } from "@sanany/shared";
import type { MarketplaceListing, PaginatedResult, SellerProfile, SellerProfileListingsTab, SellerRating } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileIcon } from "../components/mobile-icons";
import { MobileListingTile } from "../components/mobile-listing-tile";
import { MobileSectionHeader } from "../components/mobile-section-header";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { getMobileSellersRepository } from "../lib/sellers-repository";
import { mobileLayout, mobileRadius, mobileSpacing } from "../theme/mobile-theme";

type ProfileScreenProps = {
  direction: Direction;
  onOpenListing(listing: MarketplaceListing): void;
  onOpenVerification(): void;
  onOpenEditProfile(): void;
  onOpenMyAds(): void;
};

type ProfileTab = "all" | "active" | "sold" | "ratings";
type OwnerSummary = { active: number; drafts: number; reserved: number };

const PAGE_SIZE = 8;

function getRatingStars(value: number): string {
  const rounded = Math.round(value);
  return `${"★".repeat(Math.max(0, rounded))}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

function normalizeWebsiteForOpen(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getTrustScore(profile: SellerProfile, completionPercentage: number): number {
  const ratingPart = Math.min(100, Math.max(0, Math.round(profile.ratingAverage * 20)));
  const score = Math.round((ratingPart * 0.65) + (completionPercentage * 0.25) + (profile.isVerified ? 10 : 0));
  return Math.max(0, Math.min(100, score));
}

export function ProfileScreen({ direction, onOpenListing, onOpenVerification, onOpenEditProfile, onOpenMyAds }: ProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const { accountProfile, snapshot } = useAuth();
  const repository = useMemo(() => getMobileSellersRepository(), []);
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const [tab, setTab] = useState<ProfileTab>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);
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
  const [error, setError] = useState<string | null>(null);

  const loadProfileData = useCallback(async () => {
    if (!snapshot.user?.id) {
      setIsLoading(false);
      setProfile(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const listingsTab: SellerProfileListingsTab = tab === "sold" ? "sold" : tab === "active" ? "available" : "all";
    try {
      const [profileResult, listingsResult, ratingsResult] = await Promise.all([
        repository.getProfile(snapshot.user.id, snapshot.user.id),
        repository.listSellerListings({ sellerId: snapshot.user.id, viewerId: snapshot.user.id, tab: listingsTab, sort: "newest", page, pageSize: PAGE_SIZE }),
        repository.listSellerRatings({ sellerId: snapshot.user.id, sort: "newest", page, pageSize: PAGE_SIZE })
      ]);
      setProfile(profileResult);
      setListingsData(listingsResult);
      setRatingsData(ratingsResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("sellerProfile.errorLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [page, repository, snapshot.user?.id, t, tab]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    if (!snapshot.user?.id) {
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
        if (active) {
          setOwnerSummary({ active: activeListings.totalItems, drafts: draftListings.totalItems, reserved: reservedListings.totalItems });
        }
      } catch {
        if (active) setOwnerSummary(null);
      }
    };
    void run();
    return () => { active = false; };
  }, [listingsRepository, snapshot.user?.id]);

  const joinedLabel = profile?.joinedAt ? formatMonthYear(profile.joinedAt, i18n.language || "ar", "-") : "-";
  const completionPercentage = getProfileCompletionPercentage(accountProfile, snapshot.user?.email);
  const trustScore = profile ? getTrustScore(profile, completionPercentage) : 0;
  const profileAvatarUri = accountProfile?.avatarUrl ?? profile?.avatarUrl;
  const websiteValue = accountProfile?.website?.trim() ?? "";
  const websiteLink = normalizeWebsiteForOpen(websiteValue);
  const headerContent = (
    <View style={styles.headerContent}>
      {profile ? (
        <View style={styles.headerCard}>
          <View style={[styles.headerTopRow, isRtl ? styles.rowRtl : undefined]}>
            <View style={styles.avatar}>
              {profileAvatarUri ? (
                <Image source={{ uri: profileAvatarUri }} style={styles.avatarImage} />
              ) : (
                <MobileIcon name="profile" size={30} color="#0f766e" focused />
              )}
            </View>
            <View style={styles.headerMeta}>
              <View style={[styles.nameRow, isRtl ? styles.rowRtl : undefined]}>
                <Text style={[styles.name, { textAlign }]} numberOfLines={1}>
                  {profile.displayName}
                </Text>
                {profile.isVerified ? <MobileIcon name="verified" size={16} color="#0f766e" focused /> : null}
              </View>
              <Text style={[styles.username, { textAlign }]}>{profile.username ? `@${profile.username}` : `#${profile.id.slice(0, 8)}`}</Text>
              {accountProfile?.bio?.trim() ? <Text style={[styles.bio, { textAlign }]}>{accountProfile.bio}</Text> : null}
              {websiteLink ? (
                <Pressable onPress={() => void Linking.openURL(websiteLink)}>
                  <Text style={[styles.website, { textAlign }]} numberOfLines={1}>
                    {websiteValue}
                  </Text>
                </Pressable>
              ) : null}
              <View style={[styles.ratingRow, isRtl ? styles.rowRtl : undefined]}>
                <Text style={styles.ratingValue}>{profile.ratingAverage.toFixed(1)}</Text>
                <Text style={styles.ratingStars}>{getRatingStars(profile.ratingAverage)}</Text>
                <Text style={styles.ratingCount}>{t("sellerProfile.ratingCount", { count: profile.ratingCount })}</Text>
              </View>
              <Text style={[styles.info, { textAlign }]}>
                {t("profile.header.memberSince", { value: joinedLabel })} • {profile.city ?? t("sellerProfile.unknownCity")}
              </Text>
              <Text style={[styles.trustScore, { textAlign }]}>{t("profile.header.trustScore", { value: trustScore })}</Text>
            </View>
            {profile.isOwner ? (
              <Pressable style={styles.editButton} onPress={onOpenEditProfile}>
                <MobileIcon name="edit" size={18} color="#0f766e" focused />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {isLoading ? <Text style={[styles.infoText, { textAlign }]}>{t("common.loading")}</Text> : null}
      {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}

      {profile ? (
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile.listingsCount}</Text>
            <Text style={styles.statLabel}>{t("sellerProfile.stats.listings")}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile.soldListingsCount}</Text>
            <Text style={styles.statLabel}>{t("sellerProfile.stats.sold")}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile.followersCount}</Text>
            <Text style={styles.statLabel}>{t("sellerProfile.stats.followers")}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>{t("sellerProfile.stats.following")}</Text>
          </View>
        </View>
      ) : null}

      {ownerSummary !== null ? (
        <Pressable style={styles.sellerCard} onPress={onOpenMyAds}>
          <View style={[styles.sellerCardHeader, isRtl ? styles.rowRtl : undefined]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.sellerCardTitle, { textAlign }]}>{t("profile.sellerWorkspace.title")}</Text>
              <Text style={[styles.sellerCardSubtitle, { textAlign }]}>{t("profile.sellerWorkspace.subtitle")}</Text>
            </View>
          </View>
          <View style={styles.ownerGrid}>
            <View style={[styles.ownerMetricCard, styles.ownerMetricActive]}>
              <Text style={styles.ownerMetricLabel}>{t("profile.sellerWorkspace.active")}</Text>
              <Text style={styles.ownerMetricValue}>{ownerSummary.active}</Text>
            </View>
            <View style={[styles.ownerMetricCard, styles.ownerMetricDrafts]}>
              <Text style={styles.ownerMetricLabel}>{t("profile.sellerWorkspace.drafts")}</Text>
              <Text style={styles.ownerMetricValue}>{ownerSummary.drafts}</Text>
            </View>
            <View style={[styles.ownerMetricCard, styles.ownerMetricReserved]}>
              <Text style={styles.ownerMetricLabel}>{t("profile.sellerWorkspace.reserved")}</Text>
              <Text style={styles.ownerMetricValue}>{ownerSummary.reserved}</Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.completionCard}>
        <View style={[styles.completionHeader, isRtl ? styles.rowRtl : undefined]}>
          <View style={styles.completionMeta}>
            <Text style={[styles.completionTitle, { textAlign }]}>{t("profile.completion.title")}</Text>
            <Text style={[styles.completionSubtitle, { textAlign }]}>{t("profile.completion.subtitle")}</Text>
          </View>
          <Text style={styles.completionValue}>{t("profile.completion.progress", { value: completionPercentage })}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completionPercentage}%` }]} />
        </View>
        <Pressable style={styles.verificationAction} onPress={onOpenVerification}>
          <Text style={styles.verificationActionLabel}>{t("profile.verificationFlow.action")}</Text>
        </Pressable>
      </View>

      <View style={[styles.tabsRow, isRtl ? styles.rowRtl : undefined]}>
        {(["all", "active", "sold", "ratings"] as const).map((tabKey) => (
          <Pressable key={tabKey} style={[styles.tabButton, tab === tabKey ? styles.tabButtonActive : undefined]} onPress={() => setTab(tabKey)}>
            <Text style={[styles.tabLabel, tab === tabKey ? styles.tabLabelActive : undefined]}>{t(`profile.tabs.${tabKey}`)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {tab === "ratings" ? (
        <FlatList
          key="profile-ratings"
          data={ratingsData.items}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={headerContent}
          contentContainerStyle={styles.ratingsContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.ratingCard}>
              <Text style={[styles.ratingCardTitle, { textAlign }]}>{item.raterName ?? t("sellerProfile.anonymousRater")}</Text>
              <Text style={[styles.ratingCardStars, { textAlign }]}>{getRatingStars(item.rating)}</Text>
              {item.comment ? <Text style={[styles.ratingCardComment, { textAlign }]}>{item.comment}</Text> : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          key={`profile-listings-${tab}`}
          data={listingsData.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={headerContent}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MobileListingTile
              direction={direction}
              listing={item}
              width={mobileLayout.tileWidth}
              onPress={() => {
                onOpenListing(item);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  headerContent: {
    gap: mobileLayout.sectionGap,
    paddingTop: mobileLayout.screenPaddingTop,
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingBottom: mobileSpacing.xs
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  headerCard: {
    borderRadius: mobileRadius.md,
    backgroundColor: "#ffffff",
    padding: mobileLayout.cardPadding
  },
  headerTopRow: {
    flexDirection: "row",
    gap: mobileSpacing.xs,
    alignItems: "flex-start"
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdfa",
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  headerMeta: {
    flex: 1,
    gap: mobileSpacing.xxs
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdfa"
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xxs
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  username: {
    fontSize: 12,
    color: "#0f766e"
  },
  bio: {
    fontSize: 11,
    lineHeight: 16,
    color: "#334155"
  },
  website: {
    fontSize: 12,
    color: "#0f766e",
    textDecorationLine: "underline"
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a"
  },
  ratingStars: {
    fontSize: 12,
    color: "#f59e0b"
  },
  ratingCount: {
    fontSize: 11,
    color: "#64748b"
  },
  info: {
    fontSize: 11,
    color: "#64748b"
  },
  trustScore: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  statsRow: {
    flexDirection: "row",
    gap: mobileSpacing.xxs
  },
  sellerCard: {
    borderRadius: mobileRadius.lg,
    backgroundColor: "#ffffff",
    padding: mobileLayout.cardPadding,
    gap: mobileSpacing.xs
  },
  sellerCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.xs
  },
  sellerCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a"
  },
  sellerCardSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: "#64748b"
  },
  ownerGrid: {
    flexDirection: "row",
    gap: mobileSpacing.xs
  },
  ownerMetricCard: {
    flex: 1,
    borderRadius: mobileRadius.sm,
    padding: mobileLayout.cardPadding,
    gap: mobileSpacing.xxs
  },
  ownerMetricActive: {
    backgroundColor: "#ecfdfa"
  },
  ownerMetricDrafts: {
    backgroundColor: "#fefce8"
  },
  ownerMetricReserved: {
    backgroundColor: "#fff7ed"
  },
  ownerMetricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569"
  },
  ownerMetricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2
  },
  completionCard: {
    borderRadius: mobileRadius.md,
    backgroundColor: "#ffffff",
    padding: mobileLayout.cardPadding,
    gap: mobileSpacing.xs
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  completionMeta: {
    flex: 1,
    gap: mobileSpacing.xxs
  },
  completionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  completionSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: "#64748b"
  },
  completionValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f766e"
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0f766e"
  },
  verificationAction: {
    minHeight: 44,
    borderRadius: mobileRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e"
  },
  verificationActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff"
  },
  statCell: {
    flex: 1,
    borderRadius: mobileRadius.sm,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: mobileSpacing.xs
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f766e"
  },
  statLabel: {
    marginTop: 3,
    fontSize: 11,
    color: "#64748b"
  },
  tabsRow: {
    flexDirection: "row",
    gap: mobileSpacing.xs
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
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
  gridContent: {
    gap: mobileSpacing.xs,
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingBottom: mobileLayout.screenPaddingBottom
  },
  gridRow: {
    justifyContent: "space-between"
  },
  ratingsContent: {
    gap: mobileSpacing.xs,
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingBottom: mobileLayout.screenPaddingBottom
  },
  ratingCard: {
    borderRadius: mobileRadius.sm,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: mobileLayout.cardPadding,
    gap: mobileSpacing.xxs
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
  }
});
