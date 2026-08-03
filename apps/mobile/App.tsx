import "./global.css";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider, useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { Animated, Linking, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { isAuthenticated } from "@sanany/auth";
import type { MarketplaceListing } from "@sanany/types";
import type { CommissionReviewPreviewState } from "@sanany/shared";
import { getDirection } from "@sanany/utils";
import { AuthProvider, useAuth } from "./src/auth/auth-context";
import { LanguageSwitcher } from "./src/components/language-switcher";
import { MobileNavigation, type MobileTab } from "./src/components/mobile-navigation";
import { AddListingScreen } from "./src/screens/add-listing-screen";
import { EditListingScreen } from "./src/screens/edit-listing-screen";
import { AuthScreen } from "./src/screens/auth-screen";
import { ChatScreen } from "./src/screens/chat-screen";
import { FavoritesScreen } from "./src/screens/favorites-screen";
import { EditProfileScreen } from "./src/screens/edit-profile-screen";
import { ListingDetailsScreen } from "./src/screens/listing-details-screen";
import { MarketplaceScreen } from "./src/screens/marketplace-screen";
import { MoreScreen } from "./src/screens/more-screen";
import { MyAdsScreen } from "./src/screens/my-ads-screen";
import { NotificationsScreen } from "./src/screens/notifications-screen";
import { ProfileScreen } from "./src/screens/profile-screen";
import { SearchScreen } from "./src/screens/search-screen";
import { SellerProfileScreen } from "./src/screens/seller-profile-screen";
import { VerificationScreen } from "./src/screens/verification-screen";
import { MapScreen } from "./src/screens/map-screen";
import { mobileI18n } from "./src/i18n/mobile-i18n";
import { mobileLayout, mobileRadius } from "./src/theme/mobile-theme";

function AppContent() {
  const { t } = useTranslation();
  const { profileStatus, snapshot } = useAuth();
  const language = (mobileI18n.language || "ar") as "ar" | "en";
  const direction = getDirection(language);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<MobileTab>("explore");
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [commissionListingId, setCommissionListingId] = useState<string | null>(null);
  const [tapPaymentReturn, setTapPaymentReturn] = useState<{ tapId: string; listingId: string } | null>(null);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<MarketplaceListing | null>(null);
  const [chatIntentListing, setChatIntentListing] = useState<MarketplaceListing | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isChatThreadOpen, setIsChatThreadOpen] = useState(false);
  const [isHomePreview, setIsHomePreview] = useState(false);
  const [homePreviewState, setHomePreviewState] = useState<"loading" | "error" | "empty" | "guest" | undefined>(undefined);
  const [myAdsPreviewState, setMyAdsPreviewState] = useState<CommissionReviewPreviewState | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [exploreRefreshKey, setExploreRefreshKey] = useState(0);
  const prevActiveTab = useRef<MobileTab>("explore");
  const sceneFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeTab === "explore" && prevActiveTab.current !== "explore") {
      setExploreRefreshKey((k) => k + 1);
    }
    prevActiveTab.current = activeTab;
    Animated.sequence([
      Animated.timing(sceneFade, { toValue: 0.72, duration: 90, useNativeDriver: true }),
      Animated.timing(sceneFade, { toValue: 1, duration: 140, useNativeDriver: true })
    ]).start();
  }, [activeTab, sceneFade]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("previewScreen") === "splash") {
        return;
      }
    }

    const timer = setTimeout(() => {
      setIsSplashVisible(false);
    }, 1300);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.location) {
      return;
    }
    const applyIncomingUrl = (rawUrl: string) => {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return false;
      }

      const params = url.searchParams;
      const tapId = params.get("tap_id") ?? params.get("tapId");
      const tapListingId = params.get("listingId");
      if (params.get("tapCheckout") === "1" && tapListingId) {
        setIsHomePreview(false);
        setMyAdsPreviewState(null);
        setCommissionListingId(tapListingId);
        setTapPaymentReturn(tapId ? { tapId, listingId: tapListingId } : null);
        setActiveTab("myAds");
        setIsSplashVisible(false);
        return true;
      }

      return false;
    };

    if (applyIncomingUrl(window.location.href)) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("previewScreen") === "splash") {
      setIsSplashVisible(true);
      return;
    }

    if (params.get("previewScreen") === "home") {
      setIsHomePreview(true);
      setIsSplashVisible(false);
      const nextPreviewState = params.get("previewState");
      if (nextPreviewState === "loading" || nextPreviewState === "error" || nextPreviewState === "empty" || nextPreviewState === "guest") {
        setHomePreviewState(nextPreviewState);
      }
      return;
    }

    if (params.get("previewScreen") === "myads") {
      const nextPreviewState = params.get("previewState");
      if (
        nextPreviewState === "active" ||
        nextPreviewState === "calculator" ||
        nextPreviewState === "confirmation" ||
        nextPreviewState === "loading" ||
        nextPreviewState === "failed" ||
        nextPreviewState === "success" ||
        nextPreviewState === "invoice" ||
        nextPreviewState === "sold"
      ) {
        setMyAdsPreviewState(nextPreviewState);
      } else {
        setMyAdsPreviewState("active");
      }
      setActiveTab("myAds");
      setIsSplashVisible(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const applyIncomingUrl = (rawUrl: string) => {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return;
      }

      const params = url.searchParams;
      const tapId = params.get("tap_id") ?? params.get("tapId");
      const tapListingId = params.get("listingId");
      if (params.get("tapCheckout") !== "1" || !tapListingId) {
        return;
      }
      if (!active) {
        return;
      }

      setIsHomePreview(false);
      setMyAdsPreviewState(null);
      setCommissionListingId(tapListingId);
      setTapPaymentReturn(tapId ? { tapId, listingId: tapListingId } : null);
      setActiveTab("myAds");
      setIsSplashVisible(false);
    };

    void Linking.getInitialURL().then((url) => {
      if (url) {
        applyIncomingUrl(url);
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      applyIncomingUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if ((isSplashVisible || snapshot.status === "loading" || profileStatus === "loading") && !isHomePreview && !myAdsPreviewState) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashCard}>
          <Text style={styles.splashEyebrow}>{t("auth.phoneOnboarding.sidePanel.eyebrow")}</Text>
          <Text style={styles.splashTitle}>{t("app.title")}</Text>
          <Text style={styles.splashSubtitle}>{t("auth.phoneOnboarding.sidePanel.title")}</Text>
          <Text style={styles.splashBody}>{t("auth.phoneOnboarding.sidePanel.subtitle")}</Text>
          <Text style={styles.loadingLabel}>{t("common.loading")}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isMapOpen ? styles.containerMapOpen : undefined]}>
        {isHomePreview || myAdsPreviewState || (isAuthenticated(snapshot) && profileStatus !== "loading" && profileStatus !== "anonymous") ? (
          <>
            <View style={[styles.contentCard, isMapOpen ? styles.contentCardMapOpen : undefined]}>
              {selectedListing && editingListing ? (
                <EditListingScreen
                  direction={direction}
                  listing={editingListing}
                  onBack={() => setEditingListing(null)}
                  onSaved={(updated) => {
                    setEditingListing(null);
                    setSelectedListing(updated);
                  }}
                />
              ) : selectedListing ? (
                <ListingDetailsScreen
                  direction={direction}
                  listing={selectedListing}
                  onBack={() => {
                    setSelectedListing(null);
                  }}
                  onOpenChat={(intentListing) => {
                    setChatIntentListing({ ...intentListing });
                    setActiveTab("chat");
                    setCommissionListingId(null);
                    setSelectedListing(null);
                  }}
                  onOpenListing={(nextListing) => {
                    setCommissionListingId(null);
                    setSelectedListing(nextListing);
                  }}
                  onOpenSellerProfile={(sellerId) => {
                    setSelectedListing(null);
                    setSelectedSellerId(sellerId);
                  }}
                  onEditListing={() => setEditingListing(selectedListing)}
                  onOpenCommission={(commissionListing) => {
                    setCommissionListingId(commissionListing.id);
                    setSelectedListing(null);
                    setActiveTab("myAds");
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
              ) : isVerificationOpen ? (
                <VerificationScreen
                  direction={direction}
                  onBack={() => {
                    setIsVerificationOpen(false);
                  }}
                />
              ) : isEditProfileOpen ? (
                <EditProfileScreen
                  direction={direction}
                  onBack={() => {
                    setIsEditProfileOpen(false);
                    setActiveTab("profile");
                  }}
                />
              ) : (
                <Animated.View style={[styles.scenesWrap, { opacity: sceneFade }]}>
                  <View style={[styles.scene, activeTab === "explore" ? styles.sceneActive : styles.sceneHidden]}>
                    {isMapOpen ? (
                      <MapScreen
                        direction={direction}
                        onBack={() => setIsMapOpen(false)}
                        onOpenListing={(listingId) => {
                          setIsMapOpen(false);
                          // fetch listing by id and open details
                          import("@sanany/api").then(({ createListingsRepository }) => {
                            import("./src/lib/supabase-client").then(({ getMobileSupabaseClient }) => {
                              const repo = createListingsRepository(getMobileSupabaseClient());
                              void repo.getById(listingId).then((listing) => {
                                if (listing) setSelectedListing(listing);
                              });
                            });
                          });
                        }}
                      />
                    ) : isSearchOpen ? (
                      <SearchScreen
                        direction={direction}
                        initialSearch={homeSearchQuery}
                        onBack={() => setIsSearchOpen(false)}
                        onOpenListing={setSelectedListing}
                      />
                    ) : (
                      <MarketplaceScreen
                        direction={direction}
                        refreshKey={exploreRefreshKey}
                        previewState={isHomePreview ? homePreviewState : undefined}
                        onOpenListing={setSelectedListing}
                        onOpenMyAds={() => setActiveTab("myAds")}
                        onOpenAuth={() => setActiveTab("profile")}
                        onOpenMap={() => setIsMapOpen(true)}
                        onOpenAddListing={() => setActiveTab("add")}
                        onOpenSearch={(initialSearch) => {
                          setHomeSearchQuery(initialSearch ?? "");
                          setIsSearchOpen(true);
                        }}
                      />
                    )}
                  </View>
                  <View style={[styles.scene, activeTab === "add" ? styles.sceneActive : styles.sceneHidden]}>
                    <AddListingScreen
                      direction={direction}
                      onCreated={(listing) => {
                        setActiveTab("explore");
                        setSelectedListing(listing);
                      }}
                      onExit={() => {
                        setSelectedListing(null);
                        setActiveTab("myAds");
                      }}
                    />
                  </View>
                  <View style={[styles.scene, activeTab === "chat" ? styles.sceneActive : styles.sceneHidden]}>
                    <ChatScreen
                      direction={direction}
                      openListingIntent={chatIntentListing}
                      onIntentHandled={() => setChatIntentListing(null)}
                      onUnreadCountChange={setChatUnreadCount}
                      onThreadOpenChange={setIsChatThreadOpen}
                    />
                  </View>
                  <View style={[styles.scene, activeTab === "more" ? styles.sceneActive : styles.sceneHidden]}>
                    <MoreScreen
                      direction={direction}
                      onOpenProfile={() => setActiveTab("profile")}
                      onOpenMyAds={() => setActiveTab("myAds")}
                      onOpenFavorites={() => setActiveTab("favorites")}
                      onOpenNotifications={() => setActiveTab("notifications")}
                      onOpenVerification={() => setIsVerificationOpen(true)}
                    />
                  </View>
                  <View style={[styles.scene, activeTab === "myAds" ? styles.sceneActive : styles.sceneHidden]}>
                    <MyAdsScreen
                      direction={direction}
                      previewState={myAdsPreviewState}
                      commissionListingId={commissionListingId}
                      tapPaymentReturn={tapPaymentReturn}
                      onTapPaymentHandled={() => setTapPaymentReturn(null)}
                      onCommissionListingHandled={() => setCommissionListingId(null)}
                      onExploreMarketplace={() => setActiveTab("explore")}
                      onOpenListing={setSelectedListing}
                    />
                  </View>
                  <View style={[styles.scene, activeTab === "notifications" ? styles.sceneActive : styles.sceneHidden]}>
                    <NotificationsScreen direction={direction} />
                  </View>
                  <View style={[styles.scene, activeTab === "favorites" ? styles.sceneActive : styles.sceneHidden]}>
                    <FavoritesScreen direction={direction} />
                  </View>
                  <View style={[styles.scene, activeTab === "profile" ? styles.sceneActive : styles.sceneHidden]}>
                    <ProfileScreen
                      direction={direction}
                      onOpenListing={setSelectedListing}
                      onOpenVerification={() => setIsVerificationOpen(true)}
                      onOpenEditProfile={() => setIsEditProfileOpen(true)}
                      onOpenMyAds={() => setActiveTab("myAds")}
                    />
                  </View>
                </Animated.View>
              )}
            </View>
            {selectedListing || selectedSellerId || isVerificationOpen || isEditProfileOpen || editingListing || isMapOpen || (activeTab === "chat" && isChatThreadOpen) ? null : (
              <MobileNavigation
                direction={direction}
                activeTab={activeTab}
                chatUnreadCount={chatUnreadCount}
                onChange={(tab) => {
                  setSelectedListing(null);
                  setSelectedSellerId(null);
                  setIsVerificationOpen(false);
                  setIsEditProfileOpen(false);
                  setEditingListing(null);
                  setIsChatThreadOpen(false);
                  setIsSearchOpen(false);
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
    paddingHorizontal: mobileLayout.shellPaddingHorizontal,
    paddingTop: mobileLayout.shellPaddingTop,
    paddingBottom: mobileLayout.shellPaddingBottom,
    gap: mobileLayout.compactGap
  },
  containerMapOpen: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0
  },
  contentCard: {
    flex: 1,
    overflow: "hidden",
    borderRadius: mobileRadius.lg,
    backgroundColor: "#f8fbfd"
  },
  contentCardMapOpen: {
    borderRadius: 0,
    backgroundColor: "#f8fafc"
  },
  scenesWrap: {
    flex: 1
  },
  scene: {
    ...StyleSheet.absoluteFillObject
  },
  sceneActive: {
    zIndex: 2
  },
  sceneHidden: {
    zIndex: 0,
    opacity: 0,
    pointerEvents: "none"
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
  splashContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#dff4ee"
  },
  splashCard: {
    width: "100%",
    borderRadius: 30,
    backgroundColor: "#ffffff",
    paddingVertical: 28,
    paddingHorizontal: 22,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  splashEyebrow: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ecfdfa",
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a"
  },
  splashSubtitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  splashBody: {
    fontSize: 13,
    lineHeight: 20,
    color: "#475569"
  },
  loadingLabel: {
    fontSize: 14,
    color: "#0f766e",
    fontWeight: "700",
    marginTop: 2
  }
});
