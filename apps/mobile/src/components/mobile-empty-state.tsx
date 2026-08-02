import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Direction } from "@sanany/utils";
import { MobileIcon } from "./mobile-icons";
import { mobileRadius, mobileShadow, mobileSpacing } from "../theme/mobile-theme";

type MobileEmptyStateProps = {
  direction: Direction;
  icon: "marketplace" | "search" | "categories" | "myAds" | "profile" | "favorites" | "notifications" | "settings" | "chat";
  title: string;
  description: string;
  actionLabel?: string;
  onPressAction?: () => void;
};

export function MobileEmptyState({ direction, icon, title, description, actionLabel, onPressAction }: MobileEmptyStateProps) {
  const isRtl = direction === "rtl";

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MobileIcon name={icon} size={26} color="#0f766e" focused />
      </View>
      <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]}>{title}</Text>
      <Text style={[styles.description, { textAlign: isRtl ? "right" : "left" }]}>{description}</Text>
      {actionLabel && onPressAction ? (
        <Pressable style={styles.action} onPress={onPressAction}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: mobileRadius.lg,
    backgroundColor: "#ffffff",
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.lg,
    ...mobileShadow.card
  },
  iconWrap: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#ecfdfa",
    marginBottom: mobileSpacing.sm
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  description: {
    marginTop: mobileSpacing.xs,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b"
  },
  action: {
    marginTop: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: "#0D9488",
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff"
  }
});
