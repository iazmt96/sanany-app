import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatDayMonthYear, readMetadataText } from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { LanguageSwitcher } from "../components/language-switcher";
import { MobileIcon } from "../components/mobile-icons";
import { MobileSectionHeader } from "../components/mobile-section-header";

type ProfileScreenProps = {
  direction: Direction;
  onOpenMyAds(): void;
  onOpenPublicProfile(): void;
  initialView?: "profile" | "settings";
};

export function ProfileScreen({ direction, onOpenMyAds, onOpenPublicProfile, initialView = "profile" }: ProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const { snapshot, signOut } = useAuth();
  const textAlign = direction === "rtl" ? "right" : "left";
  const isRtl = direction === "rtl";
  const [isSettingsOpen, setIsSettingsOpen] = useState(initialView === "settings");
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isPromoEnabled, setIsPromoEnabled] = useState(true);
  const [isPhoneVisible, setIsPhoneVisible] = useState(true);
  const languageLabel = t(`language.${(i18n.language || "ar").startsWith("ar") ? "ar" : "en"}`);
  const accountId = snapshot.user?.id ? snapshot.user.id.slice(0, 8).toUpperCase() : "00000000";
  const accountName =
    readMetadataText(snapshot.user?.user_metadata, ["full_name", "name", "display_name", "username"]) ??
    snapshot.user?.email?.split("@")[0] ??
    t("profile.accountNameFallback");
  const phoneNumber =
    (snapshot.user?.phone && snapshot.user.phone.trim().length > 0 ? snapshot.user.phone : null) ??
    readMetadataText(snapshot.user?.user_metadata, ["phone", "phone_number", "mobile"]) ??
    t("profile.accountDetails.notProvided");
  const createdAtLabel =
    snapshot.user?.created_at && !Number.isNaN(Date.parse(snapshot.user.created_at))
      ? formatDayMonthYear(snapshot.user.created_at, i18n.language || "ar")
      : t("profile.accountDetails.notProvided");

  if (isSettingsOpen) {
    const detailsRows: Array<{ key: string; label: string; value: string }> = [
      {
        key: "username",
        label: t("profile.accountDetails.usernameLabel"),
        value: accountName
      },
      {
        key: "email",
        label: t("profile.accountDetails.emailLabel"),
        value: snapshot.user?.email ?? t("profile.accountDetails.notProvided")
      },
      {
        key: "phone",
        label: t("profile.accountDetails.phoneLabel"),
        value: phoneNumber
      },
      {
        key: "userId",
        label: t("profile.accountDetails.userIdLabel"),
        value: snapshot.user?.id ?? t("profile.accountDetails.notProvided")
      },
      {
        key: "createdAt",
        label: t("profile.accountDetails.createdAtLabel"),
        value: createdAtLabel
      }
    ];

    return (
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={[styles.headerRow, isRtl ? styles.headerRowRtl : undefined]}>
            <View style={styles.headerIdentity}>
              <Text style={[styles.headerName, { textAlign }]} numberOfLines={1}>
                {accountName}
              </Text>
              <Text style={[styles.headerId, { textAlign }]}>{accountId}</Text>
            </View>
            <View style={styles.avatarLarge}>
              <MobileIcon name="profile" size={44} color="#ffffff" focused />
            </View>
          </View>
        </View>

        <MobileSectionHeader direction={direction} title={t("profile.accountDetails.title")} subtitle={t("profile.accountDetails.subtitle")} />

        <View style={styles.detailsCard}>
          {detailsRows.map((row, index) => (
            <View key={row.key}>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailsLabel, { textAlign }]}>{row.label}</Text>
                <Text style={[styles.detailsValue, { textAlign }]} numberOfLines={1}>
                  {row.value}
                </Text>
              </View>
              {index < detailsRows.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>

        {initialView === "profile" ? (
          <Pressable
            style={[styles.action, direction === "rtl" ? styles.actionRtl : undefined]}
            onPress={() => {
              setIsSettingsOpen(false);
            }}
          >
            <View style={styles.actionLead}>
              <MobileIcon name="chevron" size={18} color="#0f766e" />
              <Text style={styles.actionLabel}>{t("profile.settings.backToProfile")}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={[styles.headerRow, isRtl ? styles.headerRowRtl : undefined]}>
          <View style={styles.headerIdentity}>
            <Text style={[styles.headerName, { textAlign }]} numberOfLines={1}>
              {accountName}
            </Text>
            <Text style={[styles.headerId, { textAlign }]}>{accountId}</Text>
          </View>
          <View style={styles.avatarLarge}>
            <MobileIcon name="profile" size={44} color="#ffffff" focused />
          </View>
        </View>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>{t("profile.stats.ads")}</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>{t("profile.stats.purchases")}</Text>
        </View>
      </View>

      <View style={styles.listCard}>
        <Pressable
          style={[styles.row, isRtl ? styles.rowRtl : undefined]}
          onPress={() => {
            setIsSettingsOpen(true);
          }}
        >
          <View style={styles.rowIcon}>
            <MobileIcon name="profile" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.accountInfo.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{t("profile.accountInfo.subtitle")}</Text>
          </View>
          <MobileIcon name="chevron" size={18} color="#94a3b8" />
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable style={[styles.row, isRtl ? styles.rowRtl : undefined]} onPress={onOpenMyAds}>
          <View style={styles.rowIcon}>
            <MobileIcon name="myAds" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.myAds.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{t("profile.myAds.subtitle")}</Text>
          </View>
          <MobileIcon name="chevron" size={18} color="#94a3b8" />
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable style={[styles.row, isRtl ? styles.rowRtl : undefined]} onPress={onOpenPublicProfile}>
          <View style={styles.rowIcon}>
            <MobileIcon name="profile" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.publicProfile.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{t("profile.publicProfile.subtitle")}</Text>
          </View>
          <MobileIcon name="chevron" size={18} color="#94a3b8" />
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable
          style={[styles.row, isRtl ? styles.rowRtl : undefined]}
          onPress={() => {
            setIsLanguageOpen((value) => !value);
          }}
        >
          <View style={styles.rowIcon}>
            <MobileIcon name="settings" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.language.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{languageLabel}</Text>
          </View>
          <MobileIcon name="chevron" size={18} color="#94a3b8" />
        </Pressable>
        {isLanguageOpen ? (
          <View style={[styles.languageWrap, isRtl ? styles.languageWrapRtl : undefined]}>
            <LanguageSwitcher />
          </View>
        ) : null}
      </View>

      <View style={styles.listCard}>
        <View style={[styles.switchRow, isRtl ? styles.rowRtl : undefined]}>
          <View style={styles.rowIcon}>
            <MobileIcon name="notifications" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.promoNotifications.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{t("profile.promoNotifications.subtitle")}</Text>
          </View>
          <Switch
            trackColor={{ false: "#cbd5e1", true: "#0f766e" }}
            thumbColor="#ffffff"
            ios_backgroundColor="#cbd5e1"
            value={isPromoEnabled}
            onValueChange={setIsPromoEnabled}
          />
        </View>
        <View style={styles.rowDivider} />
        <View style={[styles.switchRow, isRtl ? styles.rowRtl : undefined]}>
          <View style={styles.rowIcon}>
            <MobileIcon name="call" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.showPhone.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{t("profile.showPhone.subtitle")}</Text>
          </View>
          <Switch
            trackColor={{ false: "#cbd5e1", true: "#0f766e" }}
            thumbColor="#ffffff"
            ios_backgroundColor="#cbd5e1"
            value={isPhoneVisible}
            onValueChange={setIsPhoneVisible}
          />
        </View>
      </View>

      <View style={styles.listCard}>
        <Pressable style={[styles.row, isRtl ? styles.rowRtl : undefined]}>
          <View style={styles.rowIcon}>
            <MobileIcon name="call" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.contact.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{t("profile.contact.subtitle")}</Text>
          </View>
          <MobileIcon name="chevron" size={18} color="#94a3b8" />
        </Pressable>
        <View style={styles.rowDivider} />
        <Pressable style={[styles.row, isRtl ? styles.rowRtl : undefined]}>
          <View style={styles.rowIcon}>
            <MobileIcon name="settings" size={16} color="#0f766e" />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { textAlign }]}>{t("profile.terms.title")}</Text>
            <Text style={[styles.rowSubtitle, { textAlign }]}>{t("profile.terms.subtitle")}</Text>
          </View>
          <MobileIcon name="chevron" size={18} color="#94a3b8" />
        </Pressable>
      </View>

      <Pressable
        style={[styles.signOut, isRtl ? styles.rowRtl : undefined]}
        onPress={() => {
          void signOut();
        }}
      >
        <View style={styles.rowIcon}>
          <MobileIcon name="signOut" size={18} color="#b91c1c" />
        </View>
        <Text style={styles.signOutLabel}>{t("common.signOut")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10
  },
  headerCard: {
    borderRadius: 24,
    backgroundColor: "#2f8f8d",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerRowRtl: {
    flexDirection: "row-reverse"
  },
  headerIdentity: {
    flex: 1
  },
  headerName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff"
  },
  headerId: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)"
  },
  avatarLarge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.26)"
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  statBox: {
    flex: 1,
    alignItems: "center"
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f766e"
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b"
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#e2e8f0"
  },
  listCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdfa"
  },
  rowContent: {
    flex: 1
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155"
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#94a3b8"
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#f1f5f9"
  },
  languageWrap: {
    paddingTop: 2,
    paddingBottom: 8,
    alignItems: "flex-start"
  },
  languageWrapRtl: {
    alignItems: "flex-end"
  },
  card: {
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  detailsCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  detailsRow: {
    gap: 4,
    paddingVertical: 10
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b"
  },
  detailsValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a"
  },
  sectionLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b"
  },
  settingsLabel: {
    marginBottom: 4
  },
  settingsHint: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b"
  },
  settingsSwitcherWrap: {
    alignItems: "flex-start"
  },
  settingsSwitcherWrapRtl: {
    alignItems: "flex-end"
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  accountRowRtl: {
    flexDirection: "row-reverse"
  },
  accountContent: {
    flex: 1
  },
  avatar: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#ecfdfa"
  },
  label: {
    fontSize: 12,
    color: "#64748b"
  },
  email: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a"
  },
  action: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  actionRtl: {
    flexDirection: "row-reverse"
  },
  actionLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155"
  },
  signOut: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 14
  },
  signOutLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b91c1c"
  }
});
