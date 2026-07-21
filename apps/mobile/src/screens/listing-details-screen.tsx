import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { createListingsRepository } from "@sanany/api";
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
  readMetadataPhone,
  toggleStoredId
} from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileListingCard } from "../components/mobile-listing-card";
import { MobileIcon } from "../components/mobile-icons";
import { getMobileSupabaseEnv } from "../config/env";
import { setPendingChatListingIntent } from "../lib/chat-intent-store";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { resolveListingPriceLabel } from "../lib/listing-price-label";

const CHAT_OPEN_INTENT_STORAGE_KEY = "sanany:chat-open-intent";
const CHAT_OPEN_THREAD_STORAGE_KEY = "sanany:chat-open-thread-id";

type ListingDetailsScreenProps = {
  direction: Direction;
  listing: MarketplaceListing;
  onBack(): void;
  onOpenChat(listing: MarketplaceListing): void;
  onOpenListing(listing: MarketplaceListing): void;
  onOpenSellerProfile(sellerId: string): void;
  onEditListing?(): void;
  onOpenCommission?(listing: MarketplaceListing): void;
};

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

function resolveDetailErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

export function ListingDetailsScreen({ direction, listing, onBack, onOpenChat, onOpenListing, onOpenSellerProfile, onEditListing, onOpenCommission }: ListingDetailsScreenProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const isRtl = direction === "rtl";
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const listingImages = useMemo(() => {
    return getRenderableListingImageUrls(listing.imageUrl);
  }, [listing.imageUrl]);
  const { width: viewportWidth } = useWindowDimensions();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const imageUrl = listingImages[activeImageIndex] ?? getPrimaryListingImageUrl(listing.imageUrl);
  const updatedAt = formatRelativeTime(listing.updatedAt ?? listing.createdAt, locale);
  const latitude = listing.latitude ?? 24.7136;
  const longitude = listing.longitude ?? 46.6753;
  const mapPreviewUrl = `https://static-maps.yandex.ru/1.x/?ll=${longitude},${latitude}&z=13&l=map&size=900,420&pt=${longitude},${latitude},pm2rdm`;
  const advertiserPhone = listing.ownerPhone?.trim() ?? "";
  const advertiserName = t("marketplace.detail.advertiserName", { id: listing.id.slice(0, 4).toUpperCase() });
  const parsedCarSpecs = useMemo(() => parseCarSpecs(listing.description), [listing.description]);
  const [viewCount, setViewCount] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingListing, setIsRefreshingListing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [similarListings, setSimilarListings] = useState<MarketplaceListing[]>([]);
  const priceLabel = useMemo(() => resolveListingPriceLabel(listing, t), [listing, t]);
  const isListingOwner = canDeleteListing(snapshot.user?.id, listing.ownerId);
  const contactPermissions = canContactListingOwner({
    viewerId: snapshot.user?.id,
    ownerId: listing.ownerId,
    ownerPhone: advertiserPhone
  });
  const canShowChatAction = contactPermissions.canChat;
  const canShowCallAction = contactPermissions.canCall;

  useEffect(() => {
    setActiveImageIndex(0);
    setPreviewImageIndex(0);
  }, [listing.id, listing.imageUrl]);

  const handleImagePagerScrollEnd = (offsetX: number, width: number, onIndexChange: (index: number) => void) => {
    if (width <= 0 || listingImages.length <= 1) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(listingImages.length - 1, Math.round(offsetX / width)));
    onIndexChange(nextIndex);
  };

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

  const refreshListing = async () => {
    if (!snapshot.user?.id || !isListingOwner || isRefreshingListing) {
      return;
    }

    setIsRefreshingListing(true);
    setActionMessage(null);
    try {
      const sessionToken = snapshot.session?.access_token;
      const repository =
        sessionToken && sessionToken.trim().length > 0
          ? createListingsRepository(
              createClient(getMobileSupabaseEnv().supabaseUrl, getMobileSupabaseEnv().supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: {
                  headers: {
                    Authorization: `Bearer ${sessionToken}`
                  }
                }
              })
            )
          : listingsRepository;
      const ownerPhone =
        (snapshot.user.phone && snapshot.user.phone.trim().length > 0 ? snapshot.user.phone.trim() : null) ??
        readMetadataPhone(snapshot.user.user_metadata) ??
        listing.ownerPhone ??
        null;
      const payload = {
        id: listing.id,
        ownerId: snapshot.user.id,
        ownerPhone: ownerPhone ?? undefined,
        offerType: listing.offerType ?? undefined,
        categorySlug: listing.categorySlug ?? undefined,
        title: listing.title,
        description: listing.description ?? "",
        price: listing.price,
        status: listing.status,
        imageUrl: listing.imageUrl ?? undefined,
        locationName: listing.locationName ?? undefined,
        latitude: listing.latitude ?? undefined,
        longitude: listing.longitude ?? undefined,
        attributes: listing.attributes ?? {}
      };
      const updatedListing =
        listing.status === "draft" ? await repository.saveDraft(payload) : await repository.publishDraft(payload);
      setActionMessage(t("marketplace.detail.updatedSuccess"));
      onOpenListing(updatedListing);
    } catch (error) {
      setActionMessage(resolveDetailErrorMessage(error, t("marketplace.detail.updateFailed")));
    } finally {
      setIsRefreshingListing(false);
    }
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
        {listingImages.length > 0 ? (
          <Pressable
            style={styles.mediaPressable}
            onPress={() => {
              setPreviewImageIndex(activeImageIndex);
              setIsImagePreviewOpen(true);
            }}
          >
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onLayout={(event) => {
                setMediaWidth(event.nativeEvent.layout.width);
              }}
              onMomentumScrollEnd={(event) => {
                handleImagePagerScrollEnd(event.nativeEvent.contentOffset.x, mediaWidth, setActiveImageIndex);
              }}
            >
              {listingImages.map((item, index) => (
                <Image key={`${listing.id}-media-${item}-${index}`} source={{ uri: item }} style={[styles.mediaImage, mediaWidth > 0 ? { width: mediaWidth } : null]} resizeMode="cover" />
              ))}
            </ScrollView>
          </Pressable>
        ) : imageUrl ? (
          <Pressable
            style={styles.mediaPressable}
            onPress={() => {
              setPreviewImageIndex(0);
              setIsImagePreviewOpen(true);
            }}
          >
            <Image source={{ uri: imageUrl }} style={styles.mediaImage} resizeMode="cover" />
          </Pressable>
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
        {listingImages.length > 1 ? (
          <View style={styles.mediaDotsWrap}>
            {listingImages.map((_, index) => (
              <View key={`${listing.id}-dot-${index}`} style={[styles.mediaDot, index === activeImageIndex ? styles.mediaDotActive : undefined]} />
            ))}
          </View>
        ) : null}
      </View>
      <Modal
        animationType="fade"
        visible={isImagePreviewOpen && listingImages.length > 0}
        transparent
        onRequestClose={() => setIsImagePreviewOpen(false)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable
            style={[styles.previewCloseButton, isRtl ? styles.previewCloseButtonRtl : undefined]}
            onPress={() => setIsImagePreviewOpen(false)}
          >
            <Text style={styles.previewCloseLabel}>{t("common.close")}</Text>
          </Pressable>
          <ScrollView
            horizontal
            pagingEnabled
            contentOffset={{ x: previewImageIndex * viewportWidth, y: 0 }}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              handleImagePagerScrollEnd(event.nativeEvent.contentOffset.x, viewportWidth, setPreviewImageIndex);
            }}
          >
            {listingImages.map((item, index) => (
              <View key={`${listing.id}-preview-${item}-${index}`} style={[styles.previewSlide, { width: viewportWidth }]}>
                <Image source={{ uri: item }} style={styles.previewImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          {listingImages.length > 1 ? (
            <View style={styles.previewDotsWrap}>
              {listingImages.map((_, index) => (
                <View key={`${listing.id}-preview-dot-${index}`} style={[styles.previewDot, index === previewImageIndex ? styles.previewDotActive : undefined]} />
              ))}
            </View>
          ) : null}
        </View>
      </Modal>

      <View style={[styles.actionsRow, isRtl ? styles.actionsRowRtl : undefined]}>
        {isListingOwner ? (
          <>
            <Pressable
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={onEditListing}
            >
              <MobileIcon name="edit" size={15} color="#ffffff" />
              <Text style={[styles.actionButtonLabel, styles.actionButtonPrimaryLabel]}>{t("marketplace.detail.editAction")}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => void shareListing()}>
              <MobileIcon name="share" size={15} color="#334155" />
              <Text style={styles.actionButtonLabel}>{t("marketplace.detail.share")}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, isRefreshingListing ? styles.actionButtonDisabled : undefined]}
              disabled={isRefreshingListing}
              onPress={() => void refreshListing()}
            >
              <MobileIcon name="refresh" size={15} color="#334155" />
              <Text style={styles.actionButtonLabel}>{t("marketplace.detail.updateAction")}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionButtonDanger, isDeleting ? styles.actionButtonDisabled : undefined]}
              disabled={isDeleting}
              onPress={deleteListing}
            >
              <MobileIcon name="trash" size={15} color="#dc2626" />
              <Text style={[styles.actionButtonLabel, styles.actionButtonDangerLabel]}>{t("marketplace.detail.deleteAction")}</Text>
            </Pressable>
          </>
        ) : (
          <>
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
          </>
        )}
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
            <MobileIcon name="refresh" size={14} color="#64748b" />
            <Text style={styles.metaLabel}>{t("marketplace.updatedAt", { value: updatedAt })}</Text>
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

        {isListingOwner ? (
          <View style={styles.section}>
            <View style={styles.commissionCard}>
              <Pressable
                style={[styles.commissionButton, listing.status === "sold" ? styles.commissionButtonDisabled : undefined]}
                disabled={listing.status === "sold"}
                onPress={() => onOpenCommission?.(listing)}
              >
                <Text style={styles.commissionButtonLabel}>
                  {listing.status === "sold" ? t("marketplace.detail.commissionTransferredAction") : t("marketplace.detail.transferCommissionAction")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
                    priceLabel={resolveListingPriceLabel(item, t)}
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
  mediaPressable: {
    flex: 1
  },
  mediaDotsWrap: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  mediaDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.45)"
  },
  mediaDotActive: {
    width: 18,
    backgroundColor: "#ffffff"
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.94)",
    justifyContent: "center"
  },
  previewCloseButton: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 3,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.64)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  previewCloseButtonRtl: {
    right: undefined,
    left: 20
  },
  previewCloseLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff"
  },
  previewSlide: {
    alignItems: "center",
    justifyContent: "center"
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  previewDotsWrap: {
    position: "absolute",
    bottom: 34,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.6)"
  },
  previewDotActive: {
    width: 20,
    backgroundColor: "#ffffff"
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
  actionButtonPrimary: {
    backgroundColor: "#0f766e"
  },
  actionButtonPrimaryLabel: {
    color: "#ffffff"
  },
  actionButtonMutedLabel: {
    color: "#94a3b8"
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
  commissionCard: {
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#f8fbfd",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    padding: 16
  },
  commissionHeader: {
    gap: 4
  },
  commissionCaption: {
    fontSize: 13,
    lineHeight: 20,
    color: "#475569"
  },
  commissionButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#0f766e",
    paddingHorizontal: 18
  },
  commissionButtonDisabled: {
    backgroundColor: "#cbd5e1"
  },
  commissionButtonLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff"
  },
  commissionNote: {
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  commissionHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
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
