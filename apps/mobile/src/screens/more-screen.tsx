import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { readMetadataText } from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { LanguageSwitcher } from "../components/language-switcher";
import { MobileIcon } from "../components/mobile-icons";
import { mobileLayout, mobileRadius, mobileSpacing } from "../theme/mobile-theme";

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

      <Section title={t("profile.more.myAdsSection")}>
        <ActionItem direction={direction} icon="myAds" label={t("profile.more.myAdsActive")} onPress={onOpenMyAds} />
        <ActionItem direction={direction} icon="myAds" label={t("profile.more.myAdsDrafts")} onPress={onOpenMyAds} />
        <ActionItem direction={direction} icon="myAds" label={t("profile.more.myAdsSold")} onPress={onOpenMyAds} />
        <ActionItem direction={direction} icon="myAds" label={t("profile.more.myAdsExpired")} onPress={onOpenMyAds} />
      </Section>

      <Section title={t("profile.more.accountSection")}>
        <ActionItem direction={direction} icon="profile" label={t("profile.more.profile")} onPress={onOpenProfile} />
        <ActionItem direction={direction} icon="verified" label={t("profile.more.verification")} onPress={onOpenVerification} />
      </Section>

      <Section title={t("profile.more.communitySection")}>
        <ActionItem direction={direction} icon="heart" label={t("profile.more.favorites")} onPress={onOpenFavorites} />
        <ActionItem direction={direction} icon="profile" label={t("profile.more.followers")} />
        <ActionItem direction={direction} icon="notifications" label={t("profile.more.notifications")} onPress={onOpenNotifications} />
      </Section>

      <Section title={t("profile.more.settingsSection")}>
        <View style={styles.languageRow}>
          <Text style={[styles.sectionTitle, { textAlign }]}>{t("profile.more.language")}</Text>
          <LanguageSwitcher />
        </View>
        <ActionItem direction={direction} icon="settings" label={t("profile.more.darkMode")} />
      </Section>

      <Section title={t("profile.more.supportSection")}>
        <ActionItem direction={direction} icon="call" label={t("profile.more.contact")} />
        <ActionItem direction={direction} icon="settings" label={t("profile.more.terms")} />
        <ActionItem direction={direction} icon="settings" label={t("profile.more.privacy")} />
        <ActionItem direction={direction} icon="settings" label={t("profile.more.about")} />
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
    gap: mobileLayout.sectionGap,
    paddingTop: mobileLayout.screenPaddingTop,
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingBottom: mobileLayout.screenPaddingBottom
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  profileCard: {
    borderRadius: mobileRadius.md,
    backgroundColor: "#ffffff",
    padding: mobileLayout.cardPadding
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
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
    gap: mobileSpacing.xxs,
    borderRadius: 999,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 10,
    paddingVertical: mobileSpacing.xs
  },
  ratingPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309"
  },
  section: {
    gap: mobileSpacing.xxs
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b"
  },
  sectionCard: {
    borderRadius: mobileRadius.md,
    backgroundColor: "#ffffff",
    paddingHorizontal: mobileSpacing.sm
  },
  actionItem: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs,
    paddingVertical: mobileSpacing.xs
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
    paddingTop: mobileSpacing.xs,
    paddingBottom: mobileSpacing.xxs
  },
  signOutButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.xs,
    borderRadius: mobileRadius.sm,
    backgroundColor: "#fef2f2",
    marginTop: mobileSpacing.xxs
  },
  signOutLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b91c1c"
  }
});
