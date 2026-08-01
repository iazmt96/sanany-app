import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getPrimaryListingImageUrl } from "@sanany/shared";
import type { MarketplaceListing } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { MobileIcon } from "./mobile-icons";

type MobileListingCardProps = {
  direction: Direction;
  listing: MarketplaceListing;
  priceLabel: string;
  statusLabel: string;
  locationFallback: string;
};

function getPrimaryImage(imageUrl: string | null): string | null {
  return getPrimaryListingImageUrl(imageUrl);
}

export function MobileListingCard({ direction, listing, priceLabel, statusLabel, locationFallback }: MobileListingCardProps) {
  const { t, i18n } = useTranslation();
  const imageUrl = getPrimaryImage(listing.imageUrl);
  const isRtl = direction === "rtl";
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
  const activityAt = listing.updatedAt ?? listing.createdAt;

  const updatedAtLabel = (() => {
    const isAr = locale === "ar";
    const date = new Date(activityAt);
    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const absMinutes = Math.abs(diffMinutes);

    // Intl.RelativeTimeFormat is not reliably available in Hermes
    if (absMinutes < 1) {
      return isAr ? "الآن" : "just now";
    }
    if (absMinutes < 60) {
      return isAr ? `منذ ${absMinutes} دقيقة` : `${absMinutes}m ago`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    const absHours = Math.abs(diffHours);

    if (absHours < 24) {
      return isAr ? `منذ ${absHours} ساعة` : `${absHours}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return isAr ? `منذ ${Math.abs(diffDays)} يوم` : `${Math.abs(diffDays)}d ago`;
  })();

  return (
    <View style={styles.card}>
      <View style={styles.media}>
        {imageUrl ? (
          <>
            <Image source={{ uri: imageUrl }} style={styles.mediaImage} resizeMode="cover" />
            <View style={styles.mediaOverlay} />
          </>
        ) : (
          <View style={styles.mediaPlaceholder}>
            <MobileIcon name="image" size={24} color="#0f766e" />
          </View>
        )}
        <View
          style={[
            styles.statusBadge,
            listing.status === "reserved" ? styles.statusReserved : listing.status === "sold" ? styles.statusSold : styles.statusAvailable
          ]}
        >
          <Text
            style={[
              styles.statusLabel,
              listing.status === "reserved" ? styles.statusLabelReserved : listing.status === "sold" ? styles.statusLabelSold : styles.statusLabelAvailable
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={1}>
          {listing.title}
        </Text>

        <Text style={[styles.description, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={2}>
          {listing.description ?? locationFallback}
        </Text>

        <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
          <View style={[styles.metaItem, isRtl ? styles.metaItemRtl : undefined]}>
            <MobileIcon name="location" size={14} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {listing.locationName ?? locationFallback}
            </Text>
          </View>

          <Text style={styles.price}>{priceLabel}</Text>
        </View>
        <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
          <View style={[styles.metaItem, isRtl ? styles.metaItemRtl : undefined]}>
            <MobileIcon name="refresh" size={14} color="#64748b" />
            <Text style={styles.metaText}>{t("marketplace.updatedAt", { value: updatedAtLabel })}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  media: {
    position: "relative",
    height: 178,
    backgroundColor: "#d9f3ef"
  },
  mediaImage: {
    width: "100%",
    height: "100%"
  },
  mediaPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d9f3ef"
  },
  mediaOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 66,
    backgroundColor: "rgba(15, 23, 42, 0.16)"
  },
  statusBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusAvailable: {
    backgroundColor: "#ecfdf5"
  },
  statusReserved: {
    backgroundColor: "#fff7ed"
  },
  statusSold: {
    backgroundColor: "#fee2e2"
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700"
  },
  statusLabelAvailable: {
    color: "#047857"
  },
  statusLabelReserved: {
    color: "#c2410c"
  },
  statusLabelSold: {
    color: "#b91c1c"
  },
  content: {
    gap: 10,
    padding: 16
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a"
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  metaRowRtl: {
    flexDirection: "row-reverse"
  },
  metaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metaItemRtl: {
    flexDirection: "row-reverse"
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: "#64748b"
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e"
  }
});
