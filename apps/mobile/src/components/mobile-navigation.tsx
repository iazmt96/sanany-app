import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { type Direction } from "@sanany/utils";
import { MobileIcon } from "./mobile-icons";

export type MobileTab = "marketplace" | "chat" | "add" | "notifications" | "account" | "myAds";

type MobileNavigationProps = {
  direction: Direction;
  activeTab: MobileTab;
  onChange(tab: MobileTab): void;
};

export function MobileNavigation({ direction, activeTab, onChange }: MobileNavigationProps) {
  const { t } = useTranslation();
  const items: Array<{ key: MobileTab; label: string; icon: "marketplace" | "chat" | "add" | "notifications" | "profile" }> = [
    { key: "marketplace", label: t("nav.marketplace"), icon: "marketplace" },
    { key: "chat", label: t("nav.chat"), icon: "chat" },
    { key: "add", label: t("nav.add"), icon: "add" },
    { key: "notifications", label: t("nav.notifications"), icon: "notifications" },
    { key: "account", label: t("nav.account"), icon: "profile" }
  ];

  return (
    <View style={[styles.container, direction === "rtl" ? styles.containerRtl : undefined]}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={[
            styles.item,
            item.key === "add" ? styles.addItem : undefined,
            activeTab === item.key ? styles.itemActive : undefined,
            activeTab === item.key && item.key === "add" ? styles.addItemActive : undefined
          ]}
          onPress={() => onChange(item.key)}
        >
          <MobileIcon
            name={item.icon}
            size={item.key === "add" ? 22 : 20}
            color={item.key === "add" ? "#ffffff" : activeTab === item.key ? "#0f766e" : "#64748b"}
            focused={activeTab === item.key}
          />
          {item.key === "add" ? null : <Text style={[styles.label, activeTab === item.key ? styles.labelActive : undefined]}>{item.label}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  containerRtl: {
    flexDirection: "row-reverse"
  },
  item: {
    minWidth: 58,
    flex: 1,
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  itemActive: {
    backgroundColor: "#ecfdfa"
  },
  addItem: {
    flex: 0,
    minWidth: 52,
    width: 52,
    height: 52,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#0f766e",
    paddingHorizontal: 0,
    paddingVertical: 0
  },
  addItemActive: {
    backgroundColor: "#0d9488"
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b"
  },
  labelActive: {
    color: "#0f766e"
  }
});
