import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import WebView from "react-native-webview";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Direction } from "@sanany/utils";
import type { MapListing } from "@sanany/api";
import { getNearbyListings } from "@sanany/api";
import { getMobileSupabaseClient } from "../lib/supabase-client";

type Props = {
  direction: Direction;
  onBack(): void;
  onOpenListing(listingId: string): void;
};

type MapMessage =
  | { type: "openListing"; listingId: string }
  | { type: "ready" };

const RADIUS_KM = 50;

function buildLeafletHtml(listings: MapListing[], userLat: number, userLng: number, isRtl: boolean): string {
  const pins = listings
    .filter((l) => l.latitude !== null && l.longitude !== null)
    .map((l) => ({
      id: l.id,
      title: l.title,
      price: l.price,
      lat: l.latitude as number,
      lng: l.longitude as number,
      img: l.imageUrl ?? null
    }));

  const pinsJson = JSON.stringify(pins);
  const fontDir = isRtl ? "rtl" : "ltr";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; direction: ${fontDir}; }
  .listing-popup { min-width: 160px; max-width: 220px; direction: ${fontDir}; }
  .listing-popup img { width: 100%; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 6px; }
  .listing-popup .title { font-size: 13px; font-weight: 600; margin-bottom: 2px; color: #1e293b; word-break: break-word; }
  .listing-popup .price { font-size: 13px; font-weight: 700; color: #0f766e; margin-bottom: 8px; }
  .listing-popup .open-btn { display: block; width: 100%; padding: 7px; background: #0f766e; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-align: center; }
  .listing-popup .open-btn:active { background: #0d6460; }
  .user-pin { background: #1d4ed8; border: 3px solid white; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var pins = ${pinsJson};
  var map = L.map('map', { zoomControl: true }).setView([${userLat}, ${userLng}], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // User location marker
  var userIcon = L.divIcon({ className: '', html: '<div class="user-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(map).bindPopup('<b style="font-size:13px">📍 موقعك</b>');

  // Listing markers
  var greenIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  function sendToApp(msg) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } else {
        window.parent.postMessage(JSON.stringify(msg), '*');
      }
    } catch(e) {}
  }

  pins.forEach(function(pin) {
    var marker = L.marker([pin.lat, pin.lng], { icon: greenIcon }).addTo(map);
    var imgHtml = pin.img ? '<img src="' + pin.img + '" alt="" onerror="this.style.display=\'none\'"/>' : '';
    var popup = L.popup({ maxWidth: 230 }).setContent(
      '<div class="listing-popup">' +
        imgHtml +
        '<div class="title">' + pin.title + '</div>' +
        '<div class="price">' + pin.price.toLocaleString('ar-SA') + ' ر.س</div>' +
        '<button class="open-btn" onclick="sendToApp({type:\'openListing\',listingId:\'' + pin.id + '\'})">فتح الإعلان</button>' +
      '</div>'
    );
    marker.bindPopup(popup);
  });

  sendToApp({ type: 'ready' });
</script>
</body>
</html>`;
}

export function MapScreen({ direction, onBack, onOpenListing }: Props) {
  const { t } = useTranslation();
  const isRtl = direction === "rtl";
  const clientRef = useRef<SupabaseClient>(getMobileSupabaseClient());

  const [phase, setPhase] = useState<"locating" | "loading" | "ready" | "permission-denied" | "error">("locating");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [listings, setListings] = useState<MapListing[]>([]);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setPhase("locating");
    setErrorMessage(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPhase("permission-denied");
      return;
    }

    let position: Location.LocationObject;
    try {
      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {
      try {
        position = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({});
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : t("mapScreen.errorLoading"));
        setPhase("error");
        return;
      }
    }

    const { latitude: lat, longitude: lng } = position.coords;
    setUserLocation({ lat, lng });
    setPhase("loading");

    try {
      const nearby = await getNearbyListings(clientRef.current, lat, lng, RADIUS_KM);
      setListings(nearby);
      setHtmlContent(buildLeafletHtml(nearby, lat, lng, isRtl));
      setPhase("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("mapScreen.errorLoading"));
      setPhase("error");
    }
  }, [isRtl, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as MapMessage;
      if (msg.type === "openListing") {
        onOpenListing(msg.listingId);
      }
    } catch {
      // ignore malformed messages
    }
  };

  // On web (Expo Web), listen for postMessage from the iframe
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(typeof event.data === "string" ? event.data : JSON.stringify(event.data)) as MapMessage;
        if (msg.type === "openListing") {
          onOpenListing(msg.listingId);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onOpenListing]);

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, isRtl ? styles.rowRtl : undefined]}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name={isRtl ? "chevron-forward" : "chevron-back"} size={22} color="#1e293b" />
        </Pressable>
        <Text style={styles.title}>{t("home.mapScreen.title")}</Text>
        {listings.length > 0 && phase === "ready" && (
          <Text style={styles.countBadge}>{listings.length}</Text>
        )}
        {(phase === "locating" || phase === "loading") && <View style={styles.spacer} />}
      </View>

      {/* Body */}
      {phase === "locating" || phase === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.hint}>{t(`home.mapScreen.${phase}`)}</Text>
        </View>
      ) : phase === "permission-denied" ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>{t("home.mapScreen.permissionDenied")}</Text>
          <Text style={[styles.hint, { textAlign: "center" }]}>{t("home.mapScreen.permissionDeniedHint")}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadData()}>
            <Text style={styles.retryLabel}>{t("home.mapScreen.retry")}</Text>
          </Pressable>
        </View>
      ) : phase === "error" ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#f87171" />
          <Text style={styles.emptyTitle}>{t("home.mapScreen.errorLoading")}</Text>
          {errorMessage ? <Text style={styles.hint}>{errorMessage}</Text> : null}
          <Pressable style={styles.retryButton} onPress={() => void loadData()}>
            <Text style={styles.retryLabel}>{t("home.mapScreen.retry")}</Text>
          </Pressable>
        </View>
      ) : htmlContent ? (
        <View style={styles.mapWrapper}>
          <WebView
            source={{ html: htmlContent }}
            style={styles.webview}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
          {userLocation && (
            <View style={styles.radiusBadge}>
              <Text style={styles.radiusBadgeText}>{t("home.mapScreen.radius", { km: RADIUS_KM })}</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  backButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#f1f5f9"
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b"
  },
  countBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  spacer: {
    width: 40
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center"
  },
  hint: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center"
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#0f766e",
    borderRadius: 12
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff"
  },
  mapWrapper: {
    flex: 1,
    position: "relative"
  },
  webview: {
    flex: 1
  },
  radiusBadge: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    backgroundColor: "rgba(15,118,110,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999
  },
  radiusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff"
  }
});
