import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { readMetadataText } from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { LanguageSwitcher } from "../components/language-switcher";
import { MobileIcon } from "../components/mobile-icons";

type MoreScreenProps = {
  direction: Direction;
  onOpenProfile(): void;
  onOpenMyAds(): void;
  onOpenFavorites(): void;
  onOpenNotifications(): void;
  onOpenVerification(): void;
};

export function MoreScreen({ direction, onOpenProfile, onOpenMyAds, onOpenFavorites, onOpenNotifications, onOpenVerification }: MoreScreenProps) {
  const { t } = useTranslation();
  const { accountProfile, snapshot, signOut } = useAuth();
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const accountName =
    accountProfile?.displayName ??
    readMetadataText(snapshot.user?.user_metadata, ["full_name", "name", "display_name", "username"]) ??
    snapshot.user?.email?.split("@")[0] ??
    t("profile.accountNameFallback");
  const accountTypeLabel = t("sellerProfile.accountType.individual");

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={[styles.profileRow, isRtl ? styles.rowRtl : undefined]}>
          <View style={styles.avatar}>
            <MobileIcon name="profile" size={24} color="#0f766e" focused />
          </View>
          <View style={styles.profileMeta}>
            <Text style={[styles.profileName, { textAlign }]} numberOfLines={1}>
              {accountName}
            </Text>
            <Text style={[styles.profileSub, { textAlign }]}>@{accountProfile?.username ?? snapshot.user?.id?.slice(0, 8).toLowerCase() ?? "sanany"}</Text>
            <Text style={[styles.profileSub, { textAlign }]}>{accountTypeLabel}</Text>
          </View>
          <View style={styles.ratingPill}>
            <MobileIcon name="star" size={14} color="#f59e0b" focused />
            <Text style={styles.ratingPillText}>5.0</Text>
          </View>
        </View>
      </View>

      <Section title={t("more.myAdsSection")}>
        <ActionItem direction={direction} icon="myAds" label={t("more.myAdsActive")} onPress={onOpenMyAds} />
        <ActionItem direction={direction} icon="myAds" label={t("more.myAdsDrafts")} onPress={onOpenMyAds} />
        <ActionItem direction={direction} icon="myAds" label={t("more.myAdsSold")} onPress={onOpenMyAds} />
        <ActionItem direction={direction} icon="myAds" label={t("more.myAdsExpired")} onPress={onOpenMyAds} />
      </Section>

      <Section title={t("more.accountSection")}>
        <ActionItem direction={direction} icon="profile" label={t("more.profile")} onPress={onOpenProfile} />
        <ActionItem direction={direction} icon="profile" label={t("more.editProfile")} onPress={onOpenProfile} />
        <ActionItem direction={direction} icon="verified" label={t("more.verification")} onPress={onOpenVerification} />
      </Section>

      <Section title={t("more.communitySection")}>
        <ActionItem direction={direction} icon="heart" label={t("more.favorites")} onPress={onOpenFavorites} />
        <ActionItem direction={direction} icon="profile" label={t("more.followers")} />
        <ActionItem direction={direction} icon="notifications" label={t("more.notifications")} onPress={onOpenNotifications} />
      </Section>

      <Section title={t("more.settingsSection")}>
        <View style={styles.languageRow}>
          <Text style={[styles.sectionTitle, { textAlign }]}>{t("more.language")}</Text>
          <LanguageSwitcher />
        </View>
        <ActionItem direction={direction} icon="settings" label={t("more.darkMode")} />
      </Section>

      <Section title={t("more.supportSection")}>
        <ActionItem direction={direction} icon="call" label={t("more.contact")} />
        <ActionItem direction={direction} icon="settings" label={t("more.terms")} />
        <ActionItem direction={direction} icon="settings" label={t("more.privacy")} />
        <ActionItem direction={direction} icon="settings" label={t("more.about")} />
      </Section>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.signOut")}
        style={[styles.signOutButton, isRtl ? styles.rowRtl : undefined]}
        onPress={() => {
          void signOut();
        }}
      >
        <MobileIcon name="signOut" size={18} color="#b91c1c" />
        <Text style={styles.signOutLabel}>{t("common.signOut")}</Text>
      </Pressable>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function ActionItem({
  direction,
  icon,
  label,
  onPress
}: {
  direction: Direction;
  icon: Parameters<typeof MobileIcon>[0]["name"];
  label: string;
  onPress?: () => void;
}) {
  const isRtl = direction === "rtl";

  return (
    <Pressable style={[styles.actionItem, isRtl ? styles.rowRtl : undefined]} onPress={onPress}>
      <View style={styles.iconWrap}>
        <MobileIcon name={icon} size={16} color="#0f766e" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <MobileIcon name="chevron" size={16} color="#94a3b8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  profileCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 12
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdfa"
  },
  profileMeta: {
    flex: 1
  },
  profileName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a"
  },
  profileSub: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b"
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  ratingPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309"
  },
  section: {
    gap: 6
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b"
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10
  },
  actionItem: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdfa"
  },
  actionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  languageRow: {
    paddingTop: 10,
    paddingBottom: 4
  },
  signOutButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    marginBottom: 4
  },
  signOutLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b91c1c"
  }
});
