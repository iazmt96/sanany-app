import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { type Direction } from "@sanany/utils";
import { MobileEmptyState } from "../components/mobile-empty-state";
import { MobileSectionHeader } from "../components/mobile-section-header";

type FavoritesScreenProps = {
  direction: Direction;
};

export function FavoritesScreen({ direction }: FavoritesScreenProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <MobileSectionHeader direction={direction} title={t("favorites.pageTitle")} subtitle={t("favorites.pageSubtitle")} />
      <MobileEmptyState direction={direction} icon="favorites" title={t("favorites.emptyTitle")} description={t("favorites.emptyHint")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});

