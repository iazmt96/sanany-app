import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { type Direction } from "@sanany/utils";
import { MobileIcon } from "../components/mobile-icons";
import { MobileSectionHeader } from "../components/mobile-section-header";

type CategoriesScreenProps = {
  direction: Direction;
  onPickCategory(query: string): void;
};

const categoryKeys = ["cars", "realestate", "electronics", "services", "furniture", "jobs"] as const;

const categoryAppearance: Record<
  (typeof categoryKeys)[number],
  { icon: "cars" | "realestate" | "electronics" | "services" | "furniture" | "jobs"; tint: string; bg: string }
> = {
  cars: { icon: "cars", tint: "#2563eb", bg: "#eff6ff" },
  realestate: { icon: "realestate", tint: "#7c3aed", bg: "#f5f3ff" },
  electronics: { icon: "electronics", tint: "#0f766e", bg: "#ecfdfa" },
  services: { icon: "services", tint: "#ea580c", bg: "#fff7ed" },
  furniture: { icon: "furniture", tint: "#b45309", bg: "#fef3c7" },
  jobs: { icon: "jobs", tint: "#db2777", bg: "#fdf2f8" }
};

export function CategoriesScreen({ direction, onPickCategory }: CategoriesScreenProps) {
  const { t } = useTranslation();
  const textAlign = direction === "rtl" ? "right" : "left";
  const isRtl = direction === "rtl";

  return (
    <View style={styles.container}>
      <MobileSectionHeader direction={direction} title={t("categories.pageTitle")} subtitle={t("categories.pageSubtitle")} />

      <View style={[styles.grid, isRtl ? styles.gridRtl : undefined]}>
        {categoryKeys.map((key) => {
          const label = t(`categories.items.${key}`);
          const appearance = categoryAppearance[key];
          return (
            <Pressable key={key} style={styles.card} onPress={() => onPickCategory(label)}>
              <View style={[styles.iconWrap, { backgroundColor: appearance.bg }]}>
                <MobileIcon name={appearance.icon} size={18} color={appearance.tint} focused />
              </View>
              <Text style={[styles.cardTitle, { textAlign }]}>{label}</Text>
              <Text style={[styles.cardHint, { textAlign }]}>{t("categories.explore")}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  gridRtl: {
    flexDirection: "row-reverse"
  },
  card: {
    width: "48%",
    minHeight: 132,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ecfdfa",
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  cardHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  }
});
