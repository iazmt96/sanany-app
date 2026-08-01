import { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { type Direction } from "@sanany/utils";
import { MobileIcon } from "./mobile-icons";
import { mobileLayout, mobileRadius, mobileShadow, mobileSpacing } from "../theme/mobile-theme";

export type VisibleMobileTab = "profile" | "explore" | "add" | "chat" | "more";
export type MobileTab = VisibleMobileTab | "myAds" | "notifications" | "favorites" | "profile";

type MobileNavigationProps = {
  direction: Direction;
  activeTab: MobileTab;
  chatUnreadCount?: number;
  onChange(tab: VisibleMobileTab): void;
};

const ACTIVE_COLOR = "#0f766e";
const INACTIVE_COLOR = "#64748b";

export function MobileNavigation({ direction, activeTab, chatUnreadCount = 0, onChange }: MobileNavigationProps) {
  const { t } = useTranslation();
  const items = useMemo(
    () =>
      [
        { key: "profile", label: t("nav.profile"), icon: "profile" },
        { key: "explore", label: t("nav.home"), icon: "home" },
        { key: "add", label: t("nav.add"), icon: "add" },
        { key: "chat", label: t("nav.chat"), icon: "chat" },
        { key: "more", label: t("nav.more"), icon: "more" }
      ] as const,
    [t]
  );

  const selectedVisibleTab: VisibleMobileTab = useMemo(() => {
    if (activeTab === "myAds" || activeTab === "notifications" || activeTab === "favorites") {
      return "more";
    }

    return activeTab;
  }, [activeTab]);

  const animValuesRef = useRef(
    Object.fromEntries(items.map((item) => [item.key, new Animated.Value(item.key === selectedVisibleTab ? 1 : 0)])) as Record<
      VisibleMobileTab,
      Animated.Value
    >
  );
  const addPressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    items.forEach((item) => {
      Animated.spring(animValuesRef.current[item.key], {
        toValue: item.key === selectedVisibleTab ? 1 : 0,
        useNativeDriver: true,
        friction: 7,
        tension: 90
      }).start();
    });
  }, [items, selectedVisibleTab]);

  const triggerAddPressAnimation = () => {
    Animated.sequence([
      Animated.timing(addPressAnim, { toValue: 0.92, duration: 90, useNativeDriver: true }),
      Animated.spring(addPressAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true })
    ]).start();
  };

  const handlePress = (tab: VisibleMobileTab) => {
    if (tab === "add") {
      triggerAddPressAnimation();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    } else {
      Haptics.selectionAsync().catch(() => undefined);
    }

    onChange(tab);
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, direction === "rtl" ? styles.containerRtl : undefined]}>
        {items.map((item) => {
          const isActive = item.key === selectedVisibleTab;
          const value = animValuesRef.current[item.key];
          const iconScale = value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
          const iconTranslate = value.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
          const labelOpacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });

          if (item.key === "add") {
            return (
              <Animated.View key={item.key} style={[styles.addButtonWrap, { transform: [{ scale: addPressAnim }] }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  android_ripple={{ color: "rgba(255,255,255,0.25)", radius: 34, borderless: false }}
                  style={styles.addButton}
                  onPress={() => handlePress(item.key)}
                >
                  <MobileIcon name="add" size={26} color="#ffffff" focused />
                </Pressable>
              </Animated.View>
            );
          }

          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              android_ripple={{ color: "rgba(15,118,110,0.12)", borderless: false }}
              style={[styles.item, isActive ? styles.itemActive : undefined]}
              onPress={() => handlePress(item.key)}
            >
              <Animated.View style={{ transform: [{ scale: iconScale }, { translateY: iconTranslate }] }}>
                <MobileIcon name={item.icon} size={20} color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR} focused={isActive} />
              </Animated.View>
              {item.key === "chat" && chatUnreadCount > 0 ? (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeLabel}>{chatUnreadCount > 99 ? "99+" : `${chatUnreadCount}`}</Text>
                </View>
              ) : null}
              <Animated.Text style={[styles.label, { opacity: labelOpacity, color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR }]}>
                {item.label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: mobileLayout.shellPaddingHorizontal
  },
  container: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: mobileSpacing.sm,
    paddingTop: mobileSpacing.xs,
    paddingBottom: Platform.select({ ios: mobileSpacing.xs, android: mobileSpacing.xs }),
    ...mobileShadow.nav
  },
  containerRtl: {
    flexDirection: "row-reverse"
  },
  item: {
    minHeight: 52,
    minWidth: 52,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.xxs,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  itemActive: {
    backgroundColor: "#ecfdfa"
  },
  addButtonWrap: {
    width: 64,
    alignItems: "center",
    marginBottom: mobileSpacing.xxs
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
    shadowColor: "#0f766e",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8
  },
  label: {
    fontSize: 10,
    fontWeight: "700"
  },
  chatBadge: {
    position: "absolute",
    top: 4,
    right: 8,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    paddingHorizontal: 4
  },
  chatBadgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ffffff"
  }
});
