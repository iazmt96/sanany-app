import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { marketplaceSeedListings } from "@sanany/shared";
import { type Direction } from "@sanany/utils";

type MarketplaceScreenProps = {
  direction: Direction;
};

export function MarketplaceScreen({ direction }: MarketplaceScreenProps) {
  const { t } = useTranslation();
  const textAlign = direction === "rtl" ? "right" : "left";

  return (
    <View style={styles.container}>
      <Text style={[styles.pageTitle, { textAlign }]}>
        {t("marketplace.pageTitle")}
      </Text>
      <Text style={[styles.pageSubtitle, { textAlign }]}>
        {t("marketplace.pageSubtitle")}
      </Text>

      <FlatList
        data={marketplaceSeedListings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t(item.titleKey)}</Text>
              <Text style={styles.badge}>
                {t(`marketplace.status.${item.status}`)}
              </Text>
            </View>
            <Text style={styles.cardSummary}>{t(item.summaryKey)}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.location}>{t(item.locationKey)}</Text>
              <Text style={styles.price}>{t("marketplace.pricePerDay", { value: item.dailyPrice })}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a"
  },
  pageSubtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 14,
    color: "#475569"
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16
  },
  cardHeader: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a"
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  cardSummary: {
    marginBottom: 8,
    fontSize: 14,
    color: "#475569"
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  location: {
    fontSize: 14,
    color: "#64748b"
  },
  price: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155"
  }
});
