"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";

type ListingsMapProps = {
  listings: MarketplaceListing[];
  className?: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const RIYADH_CENTER: Coordinates = {
  latitude: 24.7136,
  longitude: 46.6753
};

declare global {
  interface Window {
    L?: any;
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toCoordinates(listing: MarketplaceListing): Coordinates {
  if (typeof listing.latitude === "number" && typeof listing.longitude === "number") {
    return {
      latitude: listing.latitude,
      longitude: listing.longitude
    };
  }

  const seed = hashString(listing.id);
  const latOffset = (((seed % 1000) / 1000) - 0.5) * 0.16;
  const lngOffset = ((((seed * 7) % 1000) / 1000) - 0.5) * 0.2;

  return {
    latitude: RIYADH_CENTER.latitude + latOffset,
    longitude: RIYADH_CENTER.longitude + lngOffset
  };
}

async function loadLeaflet(): Promise<any> {
  if (window.L) {
    return window.L;
  }

  const cssId = "leaflet-css";
  if (!document.getElementById(cssId)) {
    const link = document.createElement("link");
    link.id = cssId;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  const scriptId = "leaflet-js";
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!existingScript) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load map library."));
      document.body.appendChild(script);
    });
  } else if (!window.L) {
    await new Promise<void>((resolve) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      const wait = window.setInterval(() => {
        if (window.L) {
          window.clearInterval(wait);
          resolve();
        }
      }, 50);
    });
  }

  return window.L;
}

export function ListingsMap({ listings, className }: ListingsMapProps) {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const markerItems = useMemo(
    () =>
      listings.map((listing) => ({
        listing,
        ...toCoordinates(listing)
      })),
    [listings]
  );

  useEffect(() => {
    let active = true;

    async function renderMap() {
      if (!mapContainerRef.current) {
        return;
      }

      const L = await loadLeaflet();
      if (!active || !mapContainerRef.current) {
        return;
      }

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: true
        }).setView([RIYADH_CENTER.latitude, RIYADH_CENTER.longitude], 10);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors"
        }).addTo(mapRef.current);
      }

      if (!markersLayerRef.current) {
        markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
      } else {
        markersLayerRef.current.clearLayers();
      }

      if (markerItems.length === 0) {
        mapRef.current.setView([RIYADH_CENTER.latitude, RIYADH_CENTER.longitude], 10);
        return;
      }

      const bounds = L.latLngBounds([]);
      markerItems.forEach((item) => {
        const marker = L.marker([item.latitude, item.longitude], {
          icon: L.divIcon({
            className: "sanany-map-marker",
            html: '<span class="sanany-map-marker__pulse"></span><span class="sanany-map-marker__dot"></span>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        });

        marker.bindPopup(
          `<strong>${item.listing.title}</strong><br/>${t("marketplace.pricePerDay", { value: item.listing.price })}`
        );
        marker.addTo(markersLayerRef.current);
        bounds.extend([item.latitude, item.longitude]);
      });

      mapRef.current.fitBounds(bounds.pad(0.2));
    }

    void renderMap();

    return () => {
      active = false;
    };
  }, [markerItems, t]);

  return <div ref={mapContainerRef} className={className ?? "h-[420px] w-full rounded-xl"} />;
}
