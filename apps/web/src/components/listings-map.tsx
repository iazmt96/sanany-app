"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import { loadGoogleMapsApi } from "../lib/google-maps";

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

function buildInfoWindowContent(title: string, priceLabel: string) {
  const container = document.createElement("div");
  container.className = "min-w-[140px] space-y-1";

  const titleElement = document.createElement("div");
  titleElement.className = "text-sm font-semibold text-slate-900";
  titleElement.textContent = title;

  const priceElement = document.createElement("div");
  priceElement.className = "text-xs text-slate-600";
  priceElement.textContent = priceLabel;

  container.append(titleElement, priceElement);
  return container;
}

export function ListingsMap({ listings, className }: ListingsMapProps) {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
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

      const googleMaps = await loadGoogleMapsApi();
      if (!active || !mapContainerRef.current) {
        return;
      }

      if (!mapRef.current) {
        mapRef.current = new googleMaps.Map(mapContainerRef.current, {
          center: { lat: RIYADH_CENTER.latitude, lng: RIYADH_CENTER.longitude },
          zoom: 10,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false
        });
      }

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      if (markerItems.length === 0) {
        mapRef.current.setCenter({ lat: RIYADH_CENTER.latitude, lng: RIYADH_CENTER.longitude });
        mapRef.current.setZoom(10);
        return;
      }

      const infoWindow = new googleMaps.InfoWindow();
      if (markerItems.length === 1) {
        const singleItem = markerItems[0];
        if (!singleItem) {
          return;
        }

        const singlePosition = { lat: singleItem.latitude, lng: singleItem.longitude };
        const singleMarker = new googleMaps.Marker({
          map: mapRef.current,
          position: singlePosition,
          title: singleItem.listing.title
        });
        singleMarker.addListener("click", () => {
          infoWindow.setContent(
            buildInfoWindowContent(singleItem.listing.title, t("marketplace.pricePerDay", { value: singleItem.listing.price }))
          );
          infoWindow.open({ anchor: singleMarker, map: mapRef.current });
        });
        markersRef.current = [singleMarker];
        mapRef.current.setCenter(singlePosition);
        mapRef.current.setZoom(13);
        return;
      }

      const bounds = new googleMaps.LatLngBounds();
      markerItems.forEach((item) => {
        const marker = new googleMaps.Marker({
          map: mapRef.current,
          position: { lat: item.latitude, lng: item.longitude },
          title: item.listing.title
        });
        marker.addListener("click", () => {
          infoWindow.setContent(buildInfoWindowContent(item.listing.title, t("marketplace.pricePerDay", { value: item.listing.price })));
          infoWindow.open({ anchor: marker, map: mapRef.current });
        });
        markersRef.current.push(marker);
        bounds.extend({ lat: item.latitude, lng: item.longitude });
      });

      mapRef.current.fitBounds(bounds);
    }

    void renderMap();

    return () => {
      active = false;
    };
  }, [markerItems, t]);

  return <div ref={mapContainerRef} className={className ?? "h-[420px] w-full rounded-xl"} />;
}
