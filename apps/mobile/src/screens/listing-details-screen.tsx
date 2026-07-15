import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import {
  FAVORITES_STORAGE_KEY,
  LISTING_VIEWS_STORAGE_KEY,
  REPORTED_LISTINGS_STORAGE_KEY,
  canContactListingOwner,
  canDeleteListing,
  formatRelativeTime,
  getPrimaryListingImageUrl,
  getRenderableListingImageUrls,
  hasStoredId,
  parseStoredIdList,
  toggleStoredId
} from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileListingCard } from "../components/mobile-listing-card";
import { MobileIcon } from "../components/mobile-icons";
import { setPendingChatListingIntent } from "../lib/chat-intent-store";
import { getMobileListingsRepository } from "../lib/listings-repository";

const CHAT_OPEN_INTENT_STORAGE_KEY = "sanany:chat-open-intent";
const CHAT_OPEN_THREAD_STORAGE_KEY = "sanany:chat-open-thread-id";

type ListingDetailsScreenProps = {
  direction: Direction;
  listing: MarketplaceListing;
  onBack(): void;
  onOpenChat(listing: MarketplaceListing): void;
  onOpenListing(listing: MarketplaceListing): void;
  onOpenSellerProfile(sellerId: string): void;
};

function getPrimaryImage(imageUrl: string | null): string | null {
  return getPrimaryListingImageUrl(imageUrl);
}

type CarSpecEntry = {
  label: string;
  value: string;
};

function parseCarSpecs(description: string | null): { cleanDescription: string | null; specs: CarSpecEntry[] } {
  if (!description || description.trim().length === 0) {
    return { cleanDescription: null, specs: [] };
  }

  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const structuredIndex = lines.findIndex((line) => line === "بيانات السيارة" || line === "Car data");
  if (structuredIndex < 0) {
    return { cleanDescription: description, specs: [] };
  }

  const specs: CarSpecEntry[] = [];
  for (const line of lines.slice(structuredIndex + 1)) {
    if (!line.startsWith("- ")) {
      continue;
    }
    const valueStart = line.indexOf(":");
    if (valueStart < 0) {
      continue;
    }
    const label = line.slice(2, valueStart).trim();
    const value = line.slice(valueStart + 1).trim();
    if (label.length > 0 && value.length > 0) {
      specs.push({ label, value });
    }
  }

  const cleanDescription = lines.slice(0, structuredIndex).join("\n").trim();
  return { cleanDescription: cleanDescription.length > 0 ? cleanDescription : null, specs };
}

function resolveSpecIcon(label: string): "cars" | "location" | "time" | "filter" | "sort" {
  const normalized = label.toLowerCase();
  if (normalized.includes("موديل") || normalized.includes("model")) {
    return "cars";
  }
  if (normalized.includes("موقع") || normalized.includes("location")) {
    return "location";
  }
  if (normalized.includes("ممشى") || normalized.includes("mileage")) {
    return "time";
  }
  if (normalized.includes("وقود") || normalized.includes("fuel")) {
    return "sort";
  }
  return "filter";
}

export function ListingDetailsScreen({ direction, listing, onBack, onOpenChat, onOpenListing, onOpenSellerProfile }: ListingDetailsScreenProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const isRtl = direction === "rtl";
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const imageUrl = getPrimaryImage(listing.imageUrl);
  const postedAt = formatRelativeTime(listing.createdAt, locale);
  const latitude = listing.latitude ?? 24.7136;
  const longitude = listing.longitude ?? 46.6753;
  const mapPreviewUrl = `https://static-maps.yandex.ru/1.x/?ll=${longitude},${latitude}&z=13&l=map&size=900,420&pt=${longitude},${latitude},pm2rdm`;
  const advertiserPhone = listing.ownerPhone?.trim() ?? "";
  const advertiserName = t("marketplace.detail.advertiserName", { id: listing.id.slice(0, 4).toUpperCase() });
  const listingImages = useMemo(() => {
    return getRenderableListingImageUrls(listing.imageUrl);
  }, [listing.imageUrl]);
  const parsedCarSpecs = useMemo(() => parseCarSpecs(listing.description), [listing.description]);
  const [viewCount, setViewCount] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [similarListings, setSimilarListings] = useState<MarketplaceListing[]>([]);
  const priceModeSpec = parsedCarSpecs.specs.find((item) => {
    const label = item.label.toLowerCase();
    return label.includes("تسعير") || label.includes("price mode");
  });
  const isNonFixedPricing =
    priceModeSpec !== undefined &&
    !priceModeSpec.value.toLowerCase().includes("fixed") &&
    !priceModeSpec.value.includes("سعر محدد");
  const priceLabel = isNonFixedPricing ? priceModeSpec.value : t("marketplace.pricePerDay", { value: listing.price });
  const isListingOwner = canDeleteListing(snapshot.user?.id, listing.ownerId);
  const contactPermissions = canContactListingOwner({
    viewerId: snapshot.user?.id,
    ownerId: listing.ownerId,
    ownerPhone: advertiserPhone
  });
  const canShowChatAction = contactPermissions.canChat;
  const canShowCallAction = contactPermissions.canCall;

  useEffect(() => {
    const bootstrapListingState = async () => {
      const viewsRaw = await AsyncStorage.getItem(LISTING_VIEWS_STORAGE_KEY);
      const views = viewsRaw ? (JSON.parse(viewsRaw) as Record<string, number>) : {};
      const nextViews = (views[listing.id] ?? 0) + 1;
      views[listing.id] = nextViews;
      await AsyncStorage.setItem(LISTING_VIEWS_STORAGE_KEY, JSON.stringify(views));
      setViewCount(nextViews);

      const favoritesRaw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      setIsFavorite(hasStoredId(favoritesRaw, listing.id));

      const reportsRaw = await AsyncStorage.getItem(REPORTED_LISTINGS_STORAGE_KEY);
      setIsReported(hasStoredId(reportsRaw, listing.id));
    };

    void bootstrapListingState();
  }, [listing.id]);

  useEffect(() => {
    let active = true;
    const primarySearchTerm = listing.title.trim().split(" ").slice(0, 2).join(" ");

    const loadSimilarListings = async () => {
      try {
        const primaryResult = await listingsRepository.list({
          search: primarySearchTerm,
          status: listing.status,
          sort: "newest",
          page: 1,
          pageSize: 8
        });

        const primaryItems = primaryResult.items.filter((item) => item.id !== listing.id);

        if (primaryItems.length >= 4) {
          if (active) {
            setSimilarListings(primaryItems.slice(0, 4));
          }
          return;
        }

        const fallbackResult = await listingsRepository.list({
          search: "",
          status: "all",
          sort: "newest",
          page: 1,
          pageSize: 12
        });

        const merged = [...primaryItems];
        for (const item of fallbackResult.items) {
          if (item.id === listing.id || merged.some((existing) => existing.id === item.id)) {
            continue;
          }
          merged.push(item);
          if (merged.length === 4) {
            break;
          }
        }

        if (active) {
          setSimilarListings(merged);
        }
      } catch {
        if (active) {
          setSimilarListings([]);
        }
      }
    };

    void loadSimilarListings();

    return () => {
      active = false;
    };
  }, [listing.id, listing.status, listing.title, listingsRepository]);

  const toggleFavorite = async () => {
    const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    const next = toggleStoredId(raw, listing.id);
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, next.serialized);
    const nextIsFavorite = next.isSelected;
    setIsFavorite(nextIsFavorite);
    setActionMessage(nextIsFavorite ? t("marketplace.detail.favoriteAdded") : t("marketplace.detail.favoriteRemoved"));
  };

  const shareListing = async () => {
    const appLink = `sanany://listing/${listing.id}`;

    try {
      await Share.share({
        title: listing.title,
        message: `${listing.title}\n${appLink}`,
        url: appLink
      });
      setActionMessage(t("marketplace.detail.shared"));
    } catch {
      setActionMessage(t("marketplace.detail.shareFailed"));
    }
  };

  const reportListing = async () => {
    const raw = await AsyncStorage.getItem(REPORTED_LISTINGS_STORAGE_KEY);
    const ids = parseStoredIdList(raw);
    if (!ids.includes(listing.id)) {
      ids.push(listing.id);
      await AsyncStorage.setItem(REPORTED_LISTINGS_STORAGE_KEY, JSON.stringify(ids));
    }

    setIsReported(true);
    setActionMessage(t("marketplace.detail.reported"));
  };

  const openCall = async () => {
    if (!canShowCallAction) {
      setActionMessage(t("marketplace.detail.contactUnavailable"));
      return;
    }

    await Linking.openURL(`tel:${advertiserPhone}`);
  };

  const openChat = async () => {
    if (!canShowChatAction) {
      setActionMessage(t("marketplace.detail.contactUnavailable"));
      return;
    }
    await AsyncStorage.setItem(CHAT_OPEN_INTENT_STORAGE_KEY, JSON.stringify(listing));
    await AsyncStorage.setItem(CHAT_OPEN_THREAD_STORAGE_KEY, listing.id);
    setPendingChatListingIntent(listing);
    onOpenChat(listing);
  };

  const openInMaps = async () => {
    await Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`);
  };

  const deleteListing = () => {
    const ownerId = snapshot.user?.id;
    if (!ownerId || !isListingOwner || isDeleting) {
      return;
    }

    Alert.alert(t("marketplace.detail.deleteConfirmTitle"), t("marketplace.detail.deleteConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("marketplace.detail.deleteConfirmButton"),
        style: "destructive",
        onPress: () => {
          setIsDeleting(true);
          void listingsRepository
            .deleteById(listing.id, ownerId)
            .then(() => {
              onBack();
            })
            .catch(() => {
              setActionMessage(t("marketplace.detail.deleteFailed"));
            })
            .finally(() => {
              setIsDeleting(false);
            });
        }
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.topBar, isRtl ? styles.topBarRtl : undefined]}>
        <Pressable style={[styles.backButton, isRtl ? styles.backButtonRtl : undefined]} onPress={onBack}>
          <MobileIcon name="chevron" size={18} color="#334155" />
          <Text style={styles.backButtonLabel}>{t("marketplace.detail.back")}</Text>
        </Pressable>
      </View>

      <View style={styles.media}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.mediaImage} resizeMode="cover" />
        ) : (
          <View style={styles.mediaFallback}>
            <MobileIcon name="image" size={28} color="#0f766e" />
          </View>
        )}
        <View style={[styles.overlayRow, isRtl ? styles.overlayRowRtl : undefined]}>
          <View style={styles.overlayPill}>
            <MobileIcon name="image" size={13} color="#ffffff" />
            <Text style={styles.overlayPillLabel}>{t("marketplace.detail.imagesCount", { count: listingImages.length || 1 })}</Text>
          </View>
          <View style={styles.overlayPill}>
            <MobileIcon name="views" size={13} color="#ffffff" />
            <Text style={styles.overlayPillLabel}>{t("marketplace.detail.viewsCount", { count: viewCount })}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.actionsRow, isRtl ? styles.actionsRowRtl : undefined]}>
        <Pressable style={[styles.actionButton, isReported ? styles.actionButtonWarn : undefined]} onPress={() => void reportListing()}>
          <MobileIcon name="report" size={15} color={isReported ? "#b45309" : "#334155"} focused={isReported} />
          <Text style={[styles.actionButtonLabel, isReported ? styles.actionButtonWarnLabel : undefined]}>{t("marketplace.detail.report")}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => void shareListing()}>
          <MobileIcon name="share" size={15} color="#334155" />
          <Text style={styles.actionButtonLabel}>{t("marketplace.detail.share")}</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, isFavorite ? styles.actionButtonFav : undefined]} onPress={() => void toggleFavorite()}>
          <MobileIcon name="favorites" size={15} color={isFavorite ? "#be185d" : "#334155"} focused={isFavorite} />
          <Text style={[styles.actionButtonLabel, isFavorite ? styles.actionButtonFavLabel : undefined]}>{t("marketplace.detail.favorite")}</Text>
        </Pressable>
        {isListingOwner ? (
          <Pressable
            style={[styles.actionButton, styles.actionButtonDanger, isDeleting ? styles.actionButtonDisabled : undefined]}
            disabled={isDeleting}
            onPress={deleteListing}
          >
            <MobileIcon name="trash" size={15} color="#dc2626" />
            <Text style={[styles.actionButtonLabel, styles.actionButtonDangerLabel]}>{t("marketplace.detail.deleteAction")}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.content}>
        <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
          <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]}>{listing.title}</Text>
          <Text
            style={[
              styles.statusBadge,
              listing.status === "reserved" ? styles.statusReserved : listing.status === "sold" ? styles.statusSold : styles.statusAvailable
            ]}
          >
            {t(`marketplace.status.${listing.status}`)}
          </Text>
        </View>

        <Text style={[styles.price, { textAlign: isRtl ? "right" : "left" }]}>{priceLabel}</Text>

        <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
          <View style={[styles.metaItem, isRtl ? styles.metaItemRtl : undefined]}>
            <MobileIcon name="time" size={14} color="#64748b" />
            <Text style={styles.metaLabel}>{t("marketplace.postedAt", { value: postedAt })}</Text>
          </View>
          <View style={[styles.metaItem, isRtl ? styles.metaItemRtl : undefined]}>
            <MobileIcon name="location" size={14} color="#64748b" />
            <Text style={styles.metaLabel}>{listing.locationName ?? t("marketplace.detail.approximateLocation")}</Text>
          </View>
        </View>

        {actionMessage ? <Text style={[styles.actionMessage, { textAlign: isRtl ? "right" : "left" }]}>{actionMessage}</Text> : null}

        {parsedCarSpecs.specs.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: isRtl ? "right" : "left" }]}>{t("marketplace.create.carDetails.title")}</Text>
            <View style={styles.specCard}>
              {parsedCarSpecs.specs.map((item) => (
                <View key={`${item.label}-${item.value}`} style={[styles.specRow, isRtl ? styles.specRowRtl : undefined]}>
                  <View style={[styles.specLabelWrap, isRtl ? styles.specLabelWrapRtl : undefined]}>
                    <MobileIcon name={resolveSpecIcon(item.label)} size={14} color="#2563eb" />
                    <Text style={styles.specLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.specValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: isRtl ? "right" : "left" }]}>{t("marketplace.detail.description")}</Text>
          <Text style={[styles.sectionText, { textAlign: isRtl ? "right" : "left" }]}>
            {parsedCarSpecs.cleanDescription ?? t("marketplace.detail.noDescription")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: isRtl ? "right" : "left" }]}>{t("marketplace.detail.advertiserTitle")}</Text>
          <Pressable
            style={[styles.advertiserCard, isRtl ? styles.advertiserCardRtl : undefined]}
            disabled={!listing.ownerId}
            onPress={() => {
              if (listing.ownerId) {
                onOpenSellerProfile(listing.ownerId);
              }
            }}
          >
            <View style={[styles.advertiserIdentity, isRtl ? styles.advertiserIdentityRtl : undefined]}>
              <View style={styles.advertiserAvatar}>
                <MobileIcon name="profile" size={24} color="#0f766e" focused />
              </View>
              <View style={styles.advertiserText}>
                <Text style={[styles.advertiserName, { textAlign: isRtl ? "right" : "left" }]}>{advertiserName}</Text>
                <Text style={[styles.advertiserRole, { textAlign: isRtl ? "right" : "left" }]}>{t("marketplace.detail.advertiserRole")}</Text>
              </View>
            </View>
            {canShowCallAction || canShowChatAction ? (
              <View style={[styles.contactButtons, isRtl ? styles.contactButtonsRtl : undefined]}>
                {canShowCallAction ? (
                  <Pressable style={styles.iconOnlyButton} onPress={() => void openCall()}>
                    <MobileIcon name="call" size={18} color="#0f766e" />
                  </Pressable>
                ) : null}
                {canShowChatAction ? (
                  <Pressable style={styles.iconOnlyButton} onPress={() => void openChat()}>
                    <MobileIcon name="chat" size={18} color="#0f766e" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
            <Text style={[styles.sectionTitle, { textAlign: isRtl ? "right" : "left" }]}>{t("marketplace.detail.locationTitle")}</Text>
            <Pressable onPress={() => void openInMaps()}>
              <Text style={styles.mapsLink}>{t("marketplace.detail.openInMaps")}</Text>
            </Pressable>
          </View>
          <Text style={[styles.sectionText, { textAlign: isRtl ? "right" : "left" }]}>{listing.locationName ?? t("marketplace.detail.approximateLocation")}</Text>
          <Pressable style={styles.mapPreviewCard} onPress={() => void openInMaps()}>
            <Image source={{ uri: mapPreviewUrl }} style={styles.mapPreviewImage} resizeMode="cover" />
            <View style={styles.mapPreviewOverlay}>
              <Text style={styles.mapPreviewOverlayText}>{t("marketplace.detail.openInMaps")}</Text>
            </View>
          </Pressable>
        </View>

        {similarListings.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: isRtl ? "right" : "left" }]}>{t("marketplace.detail.similarAdsTitle")}</Text>
            <Text style={[styles.sectionText, { textAlign: isRtl ? "right" : "left" }]}>{t("marketplace.detail.similarAdsSubtitle")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.similarRow, isRtl ? styles.similarRowRtl : undefined]}>
              {similarListings.map((item) => (
                <Pressable key={`similar-${item.id}`} style={styles.similarCardWrap} onPress={() => onOpenListing(item)}>
                  <MobileListingCard
                    direction={direction}
                    listing={item}
                    priceLabel={t("marketplace.pricePerDay", { value: item.price })}
                    statusLabel={t(`marketplace.status.${item.status}`)}
                    locationFallback={t("marketplace.detail.approximateLocation")}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 12
  },
  topBar: {
    flexDirection: "row"
  },
  topBarRtl: {
    flexDirection: "row-reverse"
  },
  backButton: {
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
  media: {
    width: "100%",
    aspectRatio: 4 / 3,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#d9f3ef"
  },
  mediaImage: {
    width: "100%",
    height: "100%"
  },
  mediaFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  overlayRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  overlayRowRtl: {
    flexDirection: "row-reverse"
  },
  overlayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  overlayPillLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff"
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  actionsRowRtl: {
    flexDirection: "row-reverse"
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingVertical: 10
  },
  actionButtonWarn: {
    backgroundColor: "#fff7ed"
  },
  actionButtonFav: {
    backgroundColor: "#fdf2f8"
  },
  actionButtonDanger: {
    backgroundColor: "#fef2f2"
  },
  actionButtonDisabled: {
    opacity: 0.5
  },
  actionButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  actionButtonWarnLabel: {
    color: "#b45309"
  },
  actionButtonFavLabel: {
    color: "#be185d"
  },
  actionButtonDangerLabel: {
    color: "#dc2626"
  },
  content: {
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    padding: 16
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  metaRowRtl: {
    flexDirection: "row-reverse"
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a"
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700"
  },
  statusAvailable: {
    backgroundColor: "#ecfdf5",
    color: "#047857"
  },
  statusReserved: {
    backgroundColor: "#fff7ed",
    color: "#c2410c"
  },
  statusSold: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c"
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f766e"
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metaItemRtl: {
    flexDirection: "row-reverse"
  },
  metaLabel: {
    fontSize: 12,
    color: "#64748b"
  },
  actionMessage: {
    fontSize: 12,
    color: "#475569"
  },
  section: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a"
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475569"
  },
  specCard: {
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    padding: 10
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  specRowRtl: {
    flexDirection: "row-reverse"
  },
  specLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1
  },
  specLabelWrapRtl: {
    flexDirection: "row-reverse"
  },
  specLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  specValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a"
  },
  advertiserCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#f8fbfd",
    padding: 12,
    paddingLeft: 64,
    position: "relative"
  },
  advertiserCardRtl: {
    flexDirection: "row-reverse"
  },
  contactButtons: {
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    left: 12,
    top: 12,
    bottom: 12,
    justifyContent: "center",
    alignItems: "center"
  },
  contactButtonsRtl: {
    left: 12,
    right: undefined,
    alignItems: "flex-start"
  },
  iconOnlyButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ecfdfa"
  },
  advertiserIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  advertiserIdentityRtl: {
    flexDirection: "row-reverse"
  },
  advertiserAvatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#ecfdfa"
  },
  advertiserText: {
    flex: 1,
    gap: 2
  },
  advertiserName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a"
  },
  advertiserRole: {
    fontSize: 12,
    color: "#64748b"
  },
  mapsLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  },
  mapPreviewCard: {
    marginTop: 6,
    height: 164,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#d9f3ef"
  },
  mapPreviewImage: {
    width: "100%",
    height: "100%"
  },
  mapPreviewOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    paddingVertical: 8
  },
  mapPreviewOverlayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff"
  },
  similarRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8
  },
  similarRowRtl: {
    flexDirection: "row-reverse"
  },
  similarCardWrap: {
    width: 268
  }
});
