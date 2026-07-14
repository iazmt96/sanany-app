import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { useTranslation } from "react-i18next";
import { getPrimaryListingImageUrl, parseListingImageUrls } from "@sanany/shared";
import type { MarketplaceListing } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { MobileIcon } from "./mobile-icons";

type MobileListingTileProps = {
  direction: Direction;
  listing: MarketplaceListing;
  onPress?(): void;
  width?: DimensionValue;
};

export function MobileListingTile({ direction, listing, onPress, width = "100%" }: MobileListingTileProps) {
  const { t, i18n } = useTranslation();
  const [isFavorite, setIsFavorite] = useState(false);
  const isRtl = direction === "rtl";
  const imageUrl = getPrimaryListingImageUrl(listing.imageUrl);
  const imageCount = useMemo(() => parseListingImageUrls(listing.imageUrl).length, [listing.imageUrl]);
  const postedAt = useMemo(() => {
    const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
    const date = new Date(listing.createdAt);
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
  }, [i18n.language, listing.createdAt]);

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
        {listing.status === "inactive" ? (
          <View style={styles.soldBadge}>
            <Text style={styles.soldLabel}>{t("marketplace.status.inactive")}</Text>
          </View>
        ) : null}
        {imageCount > 0 ? (
          <View style={[styles.photosBadge, isRtl ? styles.photosBadgeRtl : undefined]}>
            <MobileIcon name="image" size={12} color="#ffffff" />
            <Text style={styles.photosLabel}>{imageCount}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("marketplace.favorite.add")}
          style={[styles.favoriteButton, isRtl ? styles.favoriteButtonRtl : undefined]}
          onPress={() => {
            setIsFavorite((current) => !current);
          }}
        >
          <MobileIcon name="heart" size={16} color={isFavorite ? "#dc2626" : "#334155"} focused={isFavorite} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={[styles.price, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={1}>
          {t("marketplace.pricePerDay", { value: listing.price })}
        </Text>
        <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={1}>
          {listing.title}
        </Text>
        <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
          <View style={[styles.metaItem, isRtl ? styles.metaItemRtl : undefined]}>
            <MobileIcon name="location" size={12} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {listing.locationName ?? t("marketplace.detail.approximateLocation")}
            </Text>
          </View>
          <Text style={styles.metaText}>{t("marketplace.postedAt", { value: postedAt })}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    minHeight: 208
  },
  media: {
    position: "relative",
    height: 118,
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
  soldBadge: {
    position: "absolute",
    top: 8,
    left: 8,
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
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  favoriteButtonRtl: {
    right: undefined,
    left: 8
  },
  content: {
    gap: 5,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10
  },
  price: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f766e"
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
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
  }
});
