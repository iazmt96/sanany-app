import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { type Direction } from "@sanany/utils";
import { MobileEmptyState } from "../components/mobile-empty-state";
import { MobileSectionHeader } from "../components/mobile-section-header";

type NotificationsScreenProps = {
  direction: Direction;
};

export function NotificationsScreen({ direction }: NotificationsScreenProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <MobileSectionHeader direction={direction} title={t("notifications.pageTitle")} subtitle={t("notifications.pageSubtitle")} />
      <MobileEmptyState
        direction={direction}
        icon="notifications"
        title={t("notifications.emptyTitle")}
        description={t("notifications.emptyHint")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});

