import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getProfileCompletionPercentage } from "@sanany/shared";
import type { MarketplaceListing, PaginatedResult, SellerProfile, SellerProfileListingsTab, SellerRating } from "@sanany/types";
import { formatMonthYear } from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileIcon } from "../components/mobile-icons";
import { MobileListingTile } from "../components/mobile-listing-tile";
import { getMobileSellersRepository } from "../lib/sellers-repository";

type ProfileScreenProps = {
  direction: Direction;
  onBack(): void;
  onOpenListing(listing: MarketplaceListing): void;
  onOpenVerification(): void;
};

type ProfileTab = "all" | "active" | "sold" | "ratings";

const PAGE_SIZE = 8;

function getRatingStars(value: number): string {
  const rounded = Math.round(value);
  return `${"★".repeat(Math.max(0, rounded))}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

export function ProfileScreen({ direction, onBack, onOpenListing, onOpenVerification }: ProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const { accountProfile, snapshot, updateOptionalProfile } = useAuth();
  const repository = useMemo(() => getMobileSellersRepository(), []);
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const [tab, setTab] = useState<ProfileTab>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
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
  const [error, setError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [optionalProfile, setOptionalProfile] = useState({
    city: "",
    birthDate: "",
    gender: "",
    preferredContactMethod: "",
    bio: ""
  });

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    setOptionalProfile({
      city: accountProfile?.city ?? "",
      birthDate: accountProfile?.birthDate ?? "",
      gender: accountProfile?.gender ?? "",
      preferredContactMethod: accountProfile?.preferredContactMethod ?? "",
      bio: accountProfile?.bio ?? ""
    });
  }, [accountProfile?.bio, accountProfile?.birthDate, accountProfile?.city, accountProfile?.gender, accountProfile?.preferredContactMethod]);

  useEffect(() => {
    if (!snapshot.user?.id) {
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    const listingsTab: SellerProfileListingsTab = tab === "sold" ? "sold" : tab === "active" ? "available" : "all";

    void Promise.all([
      repository.getProfile(snapshot.user.id, snapshot.user.id),
      repository.listSellerListings({ sellerId: snapshot.user.id, viewerId: snapshot.user.id, tab: listingsTab, sort: "newest", page, pageSize: PAGE_SIZE }),
      repository.listSellerRatings({ sellerId: snapshot.user.id, sort: "newest", page, pageSize: PAGE_SIZE })
    ])
      .then(([profileResult, listingsResult, ratingsResult]) => {
        if (!active) return;
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
  }, [page, repository, snapshot.user?.id, t, tab]);

  const joinedLabel = profile?.joinedAt ? formatMonthYear(profile.joinedAt, i18n.language || "ar", "-") : "-";
  const completionPercentage = getProfileCompletionPercentage(accountProfile, snapshot.user?.email);

  const saveOptionalDetails = async () => {
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      await updateOptionalProfile({
        city: optionalProfile.city,
        birthDate: optionalProfile.birthDate || null,
        gender: optionalProfile.gender ? (optionalProfile.gender as "male" | "female" | "prefer_not_to_say") : null,
        preferredContactMethod: optionalProfile.preferredContactMethod
          ? (optionalProfile.preferredContactMethod as "phone" | "chat" | "whatsapp" | "email")
          : null,
        bio: optionalProfile.bio
      });
      setProfileMessage(t("profile.messages.profileSaved"));
    } catch (saveError) {
      setProfileMessage(saveError instanceof Error ? saveError.message : t("auth.errors.unknown"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={[styles.backButton, isRtl ? styles.backButtonRtl : undefined]} onPress={onBack}>
        <MobileIcon name="chevron" size={16} color="#334155" />
        <Text style={styles.backButtonLabel}>{t("sellerProfile.back")}</Text>
      </Pressable>

      {profile ? (
        <View style={styles.headerCard}>
          <View style={[styles.headerTopRow, isRtl ? styles.rowRtl : undefined]}>
            <View style={styles.avatar}>
              <MobileIcon name="profile" size={30} color="#0f766e" focused />
            </View>
            <View style={styles.headerMeta}>
              <View style={[styles.nameRow, isRtl ? styles.rowRtl : undefined]}>
                <Text style={[styles.name, { textAlign }]} numberOfLines={1}>
                  {profile.displayName}
                </Text>
                {profile.isVerified ? <MobileIcon name="verified" size={16} color="#0f766e" focused /> : null}
              </View>
              <Text style={[styles.username, { textAlign }]}>{profile.username ? `@${profile.username}` : `#${profile.id.slice(0, 8)}`}</Text>
              <View style={[styles.ratingRow, isRtl ? styles.rowRtl : undefined]}>
                <Text style={styles.ratingValue}>{profile.ratingAverage.toFixed(1)}</Text>
                <Text style={styles.ratingStars}>{getRatingStars(profile.ratingAverage)}</Text>
                <Text style={styles.ratingCount}>{t("sellerProfile.ratingCount", { count: profile.ratingCount })}</Text>
              </View>
              <Text style={[styles.info, { textAlign }]}>
                {t(`sellerProfile.accountType.${profile.accountType}`)} • {profile.city ?? t("sellerProfile.unknownCity")} • {t("sellerProfile.memberSince", { value: joinedLabel })}
              </Text>
            </View>
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

      <View style={styles.editCard}>
        <Text style={[styles.editTitle, { textAlign }]}>{t("profile.completion.action")}</Text>
        <TextInput
          style={[styles.editInput, { textAlign }]}
          value={optionalProfile.city}
          onChangeText={(value) => setOptionalProfile((current) => ({ ...current, city: value }))}
          placeholder={t("profile.completion.items.city")}
        />
        <TextInput
          style={[styles.editInput, { textAlign }]}
          value={optionalProfile.birthDate}
          onChangeText={(value) => setOptionalProfile((current) => ({ ...current, birthDate: value }))}
          placeholder={t("profile.datePlaceholder")}
        />
        <TextInput
          style={[styles.editInput, { textAlign }]}
          value={optionalProfile.gender}
          onChangeText={(value) => setOptionalProfile((current) => ({ ...current, gender: value }))}
          placeholder={t("profile.completion.items.gender")}
        />
        <TextInput
          style={[styles.editInput, { textAlign }]}
          value={optionalProfile.preferredContactMethod}
          onChangeText={(value) => setOptionalProfile((current) => ({ ...current, preferredContactMethod: value }))}
          placeholder={t("profile.completion.items.preferredContactMethod")}
        />
        <TextInput
          style={[styles.editInput, styles.editInputMultiline, { textAlign }]}
          value={optionalProfile.bio}
          onChangeText={(value) => setOptionalProfile((current) => ({ ...current, bio: value }))}
          placeholder={t("profile.completion.items.bio")}
          multiline
        />
        {profileMessage ? <Text style={[styles.profileMessage, { textAlign }]}>{profileMessage}</Text> : null}
        <Pressable style={styles.saveButton} onPress={() => void saveOptionalDetails()} disabled={isSavingProfile}>
          <Text style={styles.saveButtonLabel}>{isSavingProfile ? t("common.loading") : t("profile.edit.save")}</Text>
        </Pressable>
      </View>

      <View style={[styles.tabsRow, isRtl ? styles.rowRtl : undefined]}>
        {(["all", "active", "sold", "ratings"] as const).map((tabKey) => (
          <Pressable key={tabKey} style={[styles.tabButton, tab === tabKey ? styles.tabButtonActive : undefined]} onPress={() => setTab(tabKey)}>
            <Text style={[styles.tabLabel, tab === tabKey ? styles.tabLabelActive : undefined]}>{t(`profile.tabs.${tabKey}`)}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "ratings" ? (
        <FlatList
          data={ratingsData.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ratingsContent}
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
          data={listingsData.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <MobileListingTile
              direction={direction}
              listing={item}
              width="48.5%"
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
    flex: 1,
    gap: 10
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  backButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backButtonRtl: {
    flexDirection: "row-reverse"
  },
  backButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  headerCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 12
  },
  headerTopRow: {
    flexDirection: "row",
    gap: 10
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdfa"
  },
  headerMeta: {
    flex: 1,
    gap: 3
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
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
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
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
  statsRow: {
    flexDirection: "row",
    gap: 6
  },
  completionCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  completionMeta: {
    flex: 1,
    gap: 3
  },
  completionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  completionSubtitle: {
    fontSize: 11,
    lineHeight: 17,
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
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdfa"
  },
  verificationActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  editCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8
  },
  editTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a"
  },
  editInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 12,
    color: "#0f172a"
  },
  editInputMultiline: {
    minHeight: 84,
    paddingTop: 10
  },
  profileMessage: {
    fontSize: 11,
    color: "#0f766e"
  },
  saveButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e"
  },
  saveButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff"
  },
  statCell: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  statValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f766e"
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748b"
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
  gridContent: {
    gap: 10,
    paddingBottom: 14
  },
  gridRow: {
    justifyContent: "space-between"
  },
  ratingsContent: {
    gap: 8,
    paddingBottom: 14
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
  }
});
