import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { useTranslation } from "react-i18next";
import { getPrimaryListingImageUrl, parseListingImageUrls } from "@sanany/shared";
import type { MarketplaceListing, SellerProfile } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { MobileIcon } from "./mobile-icons";
import { resolveListingPriceLabel } from "../lib/listing-price-label";

type MobileListingTileProps = {
  direction: Direction;
  listing: MarketplaceListing;
  onPress?(): void;
  width?: DimensionValue;
  sellerProfile?: Pick<SellerProfile, "displayName" | "isVerified" | "ratingAverage" | "ratingCount"> | null;
  insightLabel?: string | null;
};

function formatSellerRating(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0";
  }

  return value.toFixed(1);
}

export function MobileListingTile({
  direction,
  listing,
  onPress,
  width = "100%",
  sellerProfile = null,
  insightLabel = null
}: MobileListingTileProps) {
  const { t, i18n } = useTranslation();
  const [isFavorite, setIsFavorite] = useState(false);
  const isRtl = direction === "rtl";
  const imageUrl = getPrimaryListingImageUrl(listing.imageUrl);
  const imageCount = useMemo(() => parseListingImageUrls(listing.imageUrl).length, [listing.imageUrl]);
  const activityAt = listing.updatedAt ?? listing.createdAt;
  const updatedAt = useMemo(() => {
    const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
    const date = new Date(activityAt);
    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const absMinutes = Math.abs(diffMinutes);
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    if (absMinutes < 60) {
      return formatter.format(diffMinutes, "minute");
    }

    const diffHours = Math.round(diffMinutes / 60);
    const absHours = Math.abs(diffHours);

    if (absHours < 24) {
      return formatter.format(diffHours, "hour");
    }

    const diffDays = Math.round(diffHours / 24);
    return formatter.format(diffDays, "day");
  }, [activityAt, i18n.language]);
  const priceLabel = useMemo(() => resolveListingPriceLabel(listing, t), [listing, t]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={listing.title} style={[styles.card, { width }]} onPress={onPress}>
      <View style={styles.media}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.mediaFallback}>
            <MobileIcon name="image" size={18} color="#0f766e" />
          </View>
        )}

        <View style={[styles.mediaTopRow, isRtl ? styles.mediaTopRowRtl : undefined]}>
          <View style={[styles.mediaBadges, isRtl ? styles.mediaBadgesRtl : undefined]}>
            {insightLabel ? (
              <View style={styles.insightBadge}>
                <Text style={styles.insightLabel}>{insightLabel}</Text>
              </View>
            ) : null}
            {listing.status !== "available" ? (
              <View style={styles.soldBadge}>
                <Text style={styles.soldLabel}>{t(`marketplace.status.${listing.status}`)}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("marketplace.favorite.add")}
            style={styles.favoriteButton}
            onPress={() => {
              setIsFavorite((current) => !current);
            }}
          >
            <MobileIcon name="heart" size={16} color={isFavorite ? "#dc2626" : "#334155"} focused={isFavorite} />
          </Pressable>
        </View>

        {imageCount > 0 ? (
          <View style={[styles.photosBadge, isRtl ? styles.photosBadgeRtl : undefined]}>
            <MobileIcon name="image" size={12} color="#ffffff" />
            <Text style={styles.photosLabel}>{imageCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <Text style={[styles.price, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={1}>
          {priceLabel}
        </Text>
        <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={2}>
          {listing.title}
        </Text>

        <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
          <View style={[styles.metaItem, isRtl ? styles.metaItemRtl : undefined]}>
            <MobileIcon name="location" size={12} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {listing.locationName ?? t("marketplace.detail.approximateLocation")}
            </Text>
          </View>
          <View style={[styles.metaItem, isRtl ? styles.metaItemRtl : undefined]}>
            <MobileIcon name="refresh" size={12} color="#64748b" />
            <Text style={styles.metaText}>{t("marketplace.updatedAt", { value: updatedAt })}</Text>
          </View>
        </View>

        {sellerProfile ? (
          <View style={[styles.trustRow, isRtl ? styles.trustRowRtl : undefined]}>
            <View style={styles.trustCopy}>
              <Text style={[styles.sellerName, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={1}>
                {sellerProfile.displayName}
              </Text>
              <Text style={[styles.trustText, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={1}>
                {sellerProfile.isVerified
                  ? sellerProfile.ratingCount > 0
                    ? `${t("home.verifiedBadge")} · ${formatSellerRating(sellerProfile.ratingAverage)}`
                    : t("home.verifiedBadge")
                  : sellerProfile.ratingCount > 0
                    ? `${formatSellerRating(sellerProfile.ratingAverage)} · ${t("home.card.ratings", { count: sellerProfile.ratingCount })}`
                    : t("home.card.sellerReady")}
              </Text>
            </View>
            {sellerProfile.isVerified ? <MobileIcon name="verified" size={18} color="#059669" focused /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    minHeight: 248
  },
  media: {
    position: "relative",
    height: 128,
    backgroundColor: "#d9f3ef"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  mediaFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  mediaTopRow: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  mediaTopRowRtl: {
    flexDirection: "row-reverse"
  },
  mediaBadges: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  mediaBadgesRtl: {
    flexDirection: "row-reverse"
  },
  insightBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  insightLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700"
  },
  soldBadge: {
    borderRadius: 999,
    backgroundColor: "#dc2626",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  soldLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700"
  },
  photosBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.65)",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  photosBadgeRtl: {
    flexDirection: "row-reverse"
  },
  photosLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700"
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  content: {
    gap: 7,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12
  },
  price: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f766e"
  },
  title: {
    minHeight: 38,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    color: "#0f172a"
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
  metaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  metaItemRtl: {
    flexDirection: "row-reverse"
  },
  metaText: {
    flexShrink: 1,
    fontSize: 11,
    color: "#64748b"
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  trustRowRtl: {
    flexDirection: "row-reverse"
  },
  trustCopy: {
    flex: 1
  },
  sellerName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f172a"
  },
  trustText: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748b"
  }
});
