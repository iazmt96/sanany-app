import "./global.css";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider, useTranslation } from "react-i18next";
import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { isAuthenticated } from "@sanany/auth";
import type { MarketplaceListing } from "@sanany/types";
import { getDirection } from "@sanany/utils";
import { AuthProvider, useAuth } from "./src/auth/auth-context";
import { LanguageSwitcher } from "./src/components/language-switcher";
import { MobileNavigation, type MobileTab } from "./src/components/mobile-navigation";
import { AddListingScreen } from "./src/screens/add-listing-screen";
import { AuthScreen } from "./src/screens/auth-screen";
import { ChatScreen } from "./src/screens/chat-screen";
import { MarketplaceScreen } from "./src/screens/marketplace-screen";
import { ListingDetailsScreen } from "./src/screens/listing-details-screen";
import { MyAdsScreen } from "./src/screens/my-ads-screen";
import { NotificationsScreen } from "./src/screens/notifications-screen";
import { ProfileScreen } from "./src/screens/profile-screen";
import { SellerProfileScreen } from "./src/screens/seller-profile-screen";
import { mobileI18n } from "./src/i18n/mobile-i18n";

function AppContent() {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const language = (mobileI18n.language || "ar") as "ar" | "en";
  const direction = getDirection(language);
  const [activeTab, setActiveTab] = useState<MobileTab>("marketplace");
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [chatIntentListing, setChatIntentListing] = useState<MarketplaceListing | null>(null);

  if (snapshot.status === "loading") {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingLabel}>{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {isAuthenticated(snapshot) ? (
          <>
            <View style={styles.contentCard}>
              {selectedListing ? (
                <ListingDetailsScreen
                  direction={direction}
                  listing={selectedListing}
                  onBack={() => {
                    setSelectedListing(null);
                  }}
                  onOpenChat={(intentListing) => {
                    setChatIntentListing({ ...intentListing });
                    setActiveTab("chat");
                    setSelectedListing(null);
                  }}
                  onOpenListing={(nextListing) => {
                    setSelectedListing(nextListing);
                  }}
                  onOpenSellerProfile={(sellerId) => {
                    setSelectedListing(null);
                    setSelectedSellerId(sellerId);
                  }}
                />
              ) : selectedSellerId ? (
                <SellerProfileScreen
                  direction={direction}
                  sellerId={selectedSellerId}
                  onBack={() => {
                    setSelectedSellerId(null);
                  }}
                  onOpenListing={(nextListing) => {
                    setSelectedSellerId(null);
                    setSelectedListing(nextListing);
                  }}
                />
              ) : (
                <>
                  {activeTab === "marketplace" ? <MarketplaceScreen direction={direction} onOpenListing={setSelectedListing} /> : null}
                  {activeTab === "chat" ? <ChatScreen direction={direction} openListingIntent={chatIntentListing} onIntentHandled={() => setChatIntentListing(null)} /> : null}
                  {activeTab === "add" ? (
                    <AddListingScreen
                      direction={direction}
                      onCreated={(listing) => {
                        setActiveTab("marketplace");
                        setSelectedListing(listing);
                      }}
                      onExit={() => {
                        setSelectedListing(null);
                        setActiveTab("myAds");
                      }}
                    />
                  ) : null}
                  {activeTab === "notifications" ? <NotificationsScreen direction={direction} /> : null}
                  {activeTab === "account" ? (
                    <ProfileScreen
                      direction={direction}
                      onOpenMyAds={() => setActiveTab("myAds")}
                      onOpenPublicProfile={() => {
                        if (snapshot.user?.id) {
                          setSelectedSellerId(snapshot.user.id);
                        }
                      }}
                    />
                  ) : null}
                  {activeTab === "myAds" ? <MyAdsScreen direction={direction} onExploreMarketplace={() => setActiveTab("marketplace")} onOpenListing={setSelectedListing} /> : null}
                </>
              )}
            </View>
            {selectedListing || selectedSellerId ? null : (
              <MobileNavigation
                direction={direction}
                activeTab={activeTab === "myAds" ? "account" : activeTab}
                onChange={(tab) => {
                  setSelectedListing(null);
                  setSelectedSellerId(null);
                  if (tab !== "chat") {
                    setChatIntentListing(null);
                  }
                  setActiveTab(tab);
                }}
              />
            )}
          </>
        ) : (
          <View style={styles.authContainer}>
            <View style={[styles.switcherContainer, direction === "rtl" ? styles.switcherContainerRtl : undefined]}>
              <LanguageSwitcher />
            </View>
            <AuthScreen />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={mobileI18n}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <StatusBar style="dark" />
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef4f8"
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 14
  },
  contentCard: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 30,
    backgroundColor: "#f8fbfd",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 18
  },
  switcherContainer: {
    alignItems: "flex-end"
  },
  switcherContainerRtl: {
    alignItems: "flex-start"
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingLabel: {
    fontSize: 14,
    color: "#475569"
  }
});
