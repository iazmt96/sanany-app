import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Direction } from "@sanany/utils";
import type { MapListing } from "@sanany/api";
import { getNearbyListings } from "@sanany/api";
import { getMobileSupabaseClient } from "../lib/supabase-client";
import { MapWebView } from "../components/map-webview";
import { mobileRadius, mobileShadow, mobileSpacing } from "../theme/mobile-theme";

type Props = {
  direction: Direction;
  onBack(): void;
  onOpenListing(listingId: string): void;
};

type MapMessage =
  | { type: "openListing"; listingId: string }
  | { type: "ready" };

const RADIUS_KM = 50;

type MapLabels = {
  currentLocation: string;
  openListing: string;
  priceLabel: string;
};

function buildLeafletHtml(
  listings: MapListing[],
  userLat: number,
  userLng: number,
  isRtl: boolean,
  labels: MapLabels
): string {
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
  const labelsJson = JSON.stringify(labels);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; direction: ${fontDir}; }
  .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12); }
  .leaflet-popup-content { margin: 10px 10px 12px; }
  .listing-popup { min-width: 148px; max-width: 200px; direction: ${fontDir}; }
  .listing-popup img { width: 100%; height: 88px; object-fit: cover; border-radius: 8px; margin-bottom: 4px; }
  .listing-popup .title { font-size: 12px; font-weight: 600; margin-bottom: 2px; color: #1e293b; word-break: break-word; line-height: 1.4; }
  .listing-popup .price { font-size: 12px; font-weight: 700; color: #0f766e; margin-bottom: 6px; }
  .listing-popup .open-btn { display: block; width: 100%; padding: 6px; background: #0f766e; color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; text-align: center; }
  .listing-popup .open-btn:active { background: #0d6460; }
  .user-pin { background: #1d4ed8; border: 3px solid white; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var pins = ${pinsJson};
  var labels = ${labelsJson};
  var map = L.map('map', { zoomControl: false }).setView([${userLat}, ${userLng}], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // User location marker
  var userIcon = L.divIcon({ className: '', html: '<div class="user-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(map).bindPopup('<b style="font-size:12px">📍 ' + labels.currentLocation + '</b>');

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
    // Use DOM-based popup to avoid quote-escaping bugs in inline onclick/onerror handlers
    marker.bindPopup(function() {
      var container = document.createElement('div');
      container.className = 'listing-popup';
      if (pin.img) {
        var firstUrl = pin.img.split('|')[0];
        var img = document.createElement('img');
        img.src = firstUrl;
        img.alt = '';
        img.onerror = function() { this.hidden = true; };
        container.appendChild(img);
      }
      var titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.textContent = pin.title;
      container.appendChild(titleEl);
      var priceEl = document.createElement('div');
      priceEl.className = 'price';
      var formattedPrice = typeof pin.price === 'number' ? pin.price.toLocaleString('ar-SA') : pin.price;
      priceEl.textContent = labels.priceLabel.replace('{{price}}', formattedPrice);
      container.appendChild(priceEl);
      var btn = document.createElement('button');
      btn.className = 'open-btn';
      btn.textContent = labels.openListing;
      btn.addEventListener('click', function() { sendToApp({ type: 'openListing', listingId: pin.id }); });
      container.appendChild(btn);
      return container;
    }, { maxWidth: 230 });
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
  const [mapResetKey, setMapResetKey] = useState(0);

  const loadData = useCallback(async () => {
    setPhase("locating");
    setErrorMessage(null);

    let lat: number;
    let lng: number;

    if (Platform.OS === "web") {
      // Browser Geolocation API
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        const code = (err as GeolocationPositionError)?.code;
        if (code === 1) {
          setPhase("permission-denied");
        } else {
          setErrorMessage(err instanceof Error ? err.message : t("home.mapScreen.errorLoading"));
          setPhase("error");
        }
        return;
      }
    } else {
      // Native: expo-location (lazy import to avoid web crash)
      try {
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPhase("permission-denied");
          return;
        }
        let position: Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>;
        try {
          position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            position = last;
          } else {
            position = await Location.getCurrentPositionAsync({});
          }
        }
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : t("home.mapScreen.errorLoading"));
        setPhase("error");
        return;
      }
    }
    setUserLocation({ lat, lng });
    setPhase("loading");

    try {
      const nearby = await getNearbyListings(clientRef.current, lat, lng, RADIUS_KM);
      setListings(nearby);
      setHtmlContent(
        buildLeafletHtml(nearby, lat, lng, isRtl, {
          currentLocation: t("home.mapScreen.currentLocation"),
          openListing: t("home.mapScreen.openListing"),
          priceLabel: t("home.mapScreen.priceLabel", { price: "{{price}}" })
        })
      );
      setPhase("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("home.mapScreen.errorLoading"));
      setPhase("error");
    }
  }, [isRtl, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleMapMessage = (data: string) => {
    try {
      const msg = JSON.parse(data) as MapMessage;
      if (msg.type === "openListing") {
        onOpenListing(msg.listingId);
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.backButtonOverlay, isRtl ? styles.backButtonOverlayRtl : styles.backButtonOverlayLtr]}
        accessibilityLabel={t("home.mapScreen.back")}
        onPress={onBack}
      >
        <Ionicons name={isRtl ? "chevron-forward" : "chevron-back"} size={22} color="#1e293b" />
      </Pressable>

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
          <View style={[styles.topOverlays, isRtl ? styles.topOverlaysRtl : styles.topOverlaysLtr]}>
            <Pressable
              style={styles.locationButton}
              accessibilityLabel={t("home.mapScreen.currentLocation")}
              onPress={() => setMapResetKey((current) => current + 1)}
            >
              <Ionicons name="locate" size={18} color="#0f766e" />
            </Pressable>
            <View style={styles.resultsPill}>
              <Text style={styles.resultsPillText}>{t("home.mapScreen.resultsCount", { count: listings.length })}</Text>
            </View>
          </View>
          <MapWebView
            key={mapResetKey}
            html={htmlContent}
            style={styles.webview}
            onMessage={handleMapMessage}
          />
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
  backButtonOverlay: {
    position: "absolute",
    top: mobileSpacing.md,
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    ...mobileShadow.floating
  },
  backButtonOverlayLtr: {
    left: mobileSpacing.md
  },
  backButtonOverlayRtl: {
    right: mobileSpacing.md
  },
  topOverlays: {
    position: "absolute",
    top: mobileSpacing.md,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  topOverlaysLtr: {
    right: mobileSpacing.md
  },
  topOverlaysRtl: {
    left: mobileSpacing.md,
    flexDirection: "row-reverse"
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    ...mobileShadow.floating
  },
  resultsPill: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.pill,
    backgroundColor: "rgba(255,255,255,0.96)",
    ...mobileShadow.floating
  },
  resultsPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.lg
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
    marginTop: mobileSpacing.xs,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: "#0f766e",
    borderRadius: mobileRadius.sm
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
  }
});
