import { StyleSheet, Text, View } from "react-native";
import { type Direction } from "@sanany/utils";
import { mobileLayout, mobileSpacing } from "../theme/mobile-theme";

type MobileSectionHeaderProps = {
  direction: Direction;
  title: string;
  subtitle: string;
  badge?: string;
};

export function MobileSectionHeader({ direction, title, subtitle, badge }: MobileSectionHeaderProps) {
  const isRtl = direction === "rtl";

  return (
    <View style={styles.container}>
      <View style={[styles.topRow, isRtl ? styles.topRowRtl : undefined]}>
        <View style={styles.copy}>
          <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]}>{title}</Text>
          <Text style={[styles.subtitle, { textAlign: isRtl ? "right" : "left" }]}>{subtitle}</Text>
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: mobileLayout.sectionGap
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.xs
  },
  topRowRtl: {
    flexDirection: "row-reverse"
  },
  copy: {
    flex: 1,
    gap: 4
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b"
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#ecfdfa",
    paddingHorizontal: 12,
    paddingVertical: mobileSpacing.xs
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
  }
});
