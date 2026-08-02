"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { getNearbyListings, type MapListing } from "@sanany/api";
import { getWebSupabaseClient } from "../lib/supabase-client";

const RADIUS_KM = 50;

type Phase = "locating" | "loading" | "ready" | "permission-denied" | "error";

type MapPageShellProps = {
  language: string;
};

declare global {
  interface Window {
    L?: any;
  }
}

async function loadLeaflet(): Promise<any> {
  if (window.L) return window.L;

  const cssId = "leaflet-css";
  if (!document.getElementById(cssId)) {
    const link = document.createElement("link");
    link.id = cssId;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  const scriptId = "leaflet-js";
  const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!existing) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Leaflet"));
      document.body.appendChild(s);
    });
  } else if (!window.L) {
    await new Promise<void>((resolve) => {
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

export function MapPageShell({ language }: MapPageShellProps) {
  const { t } = useTranslation();
  const isRtl = language === "ar";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const [phase, setPhase] = useState<Phase>("locating");
  const [listings, setListings] = useState<MapListing[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initMap = useCallback(
    async (lat: number, lng: number, data: MapListing[]) => {
      if (!mapContainerRef.current) return;

      const L = await loadLeaflet();
      if (!mapContainerRef.current) return;

      // Destroy previous instance
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([lat, lng], 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      // User location marker
      const userIcon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;background:#0f766e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(15,118,110,0.25)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      L.marker([lat, lng], { icon: userIcon }).addTo(map).bindPopup(
        isRtl ? "موقعك الحالي" : "Your location"
      );

      if (data.length === 0) return;

      const bounds = L.latLngBounds([[lat, lng]]);

      data.forEach((listing) => {
        if (listing.latitude == null || listing.longitude == null) return;

        const price = listing.price
          ? isRtl
            ? `ر.س ${listing.price.toLocaleString("ar-SA")}`
            : `SAR ${listing.price.toLocaleString("en-US")}`
          : "";

        const imageUrl = listing.imageUrl?.split("|")[0] ?? "";

        const popupEl = document.createElement("div");
        popupEl.dir = isRtl ? "rtl" : "ltr";
        popupEl.style.cssText = "font-family:inherit;min-width:180px;max-width:220px";

        if (imageUrl) {
          const img = document.createElement("img");
          img.src = imageUrl;
          img.alt = listing.title;
          img.style.cssText =
            "width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block";
          popupEl.appendChild(img);
        }

        const titleEl = document.createElement("p");
        titleEl.textContent = listing.title;
        titleEl.style.cssText =
          "font-weight:700;font-size:13px;margin:0 0 4px;color:#0f172a;line-height:1.4;word-break:break-word";
        popupEl.appendChild(titleEl);

        if (price) {
          const priceEl = document.createElement("p");
          priceEl.textContent = price;
          priceEl.style.cssText = "font-size:13px;color:#0f766e;font-weight:600;margin:0 0 8px";
          popupEl.appendChild(priceEl);
        }

        const btnWrapper = document.createElement("div");
        const link = document.createElement("a");
        link.href = `/${language}/listing/${listing.id}`;
        link.textContent = isRtl ? "فتح الإعلان" : "Open Listing";
        link.style.cssText =
          "display:inline-block;background:#0f766e;color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;text-decoration:none";
        btnWrapper.appendChild(link);
        popupEl.appendChild(btnWrapper);

        const markerIcon = L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;background:#0f766e;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        L.marker([listing.latitude, listing.longitude], { icon: markerIcon })
          .bindPopup(popupEl, { maxWidth: 240 })
          .addTo(map);

        bounds.extend([listing.latitude, listing.longitude]);
      });

      map.fitBounds(bounds.pad(0.15));
    },
    [isRtl, language]
  );

  const loadData = useCallback(async () => {
    setPhase("locating");
    setErrorMessage(null);

    let lat: number = 24.7136;
    let lng: number = 46.6753;
    let permissionDenied = false;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("unsupported"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10_000,
          maximumAge: 60_000
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (err: any) {
      if (err?.code === 1 /* PERMISSION_DENIED */) {
        permissionDenied = true;
      }
      // On any other GPS error fall back to Riyadh center
    }

    if (permissionDenied) {
      setPhase("permission-denied");
      return;
    }

    setPhase("loading");

    try {
      const client = getWebSupabaseClient();
      const data = await getNearbyListings(client, lat, lng, RADIUS_KM);
      setListings(data);
      setPhase("ready");
      // Render map after state is set
      requestAnimationFrame(() => {
        void initMap(lat, lng, data);
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("home.mapScreen.errorLoading"));
      setPhase("error");
    }
  }, [initMap, t]);

  useEffect(() => {
    void loadData();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backHref = `/${language}`;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Top bar */}
      <div
        className={`flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 ${isRtl ? "flex-row-reverse" : ""}`}
      >
        <Link
          href={backHref}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
          aria-label={t("home.mapScreen.back")}
        >
          <svg
            className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <h1 className="flex-1 text-base font-bold text-slate-900">
          {t("home.mapScreen.title")}
        </h1>

        {phase === "ready" && listings.length > 0 && (
          <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
            {listings.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        {/* Map container — always mounted so Leaflet can attach */}
        <div
          ref={mapContainerRef}
          className="h-full w-full"
          style={{ display: phase === "ready" ? "block" : "none" }}
        />

        {/* Radius badge */}
        {phase === "ready" && (
          <div
            className={`absolute bottom-6 ${isRtl ? "right-4" : "left-4"} z-[1000] rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm`}
          >
            {t("home.mapScreen.radius", { km: RADIUS_KM })}
          </div>
        )}

        {/* Loading / error overlays */}
        {(phase === "locating" || phase === "loading") && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
            <p className="text-sm text-slate-500">{t(`home.mapScreen.${phase}`)}</p>
          </div>
        )}

        {phase === "permission-denied" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <svg
              className="h-12 w-12 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
            <p className="text-base font-semibold text-slate-700">
              {t("home.mapScreen.permissionDenied")}
            </p>
            <p className="max-w-xs text-sm text-slate-500">
              {t("home.mapScreen.permissionDeniedHint")}
            </p>
            <button
              onClick={() => void loadData()}
              className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              {t("home.mapScreen.retry")}
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <svg
              className="h-12 w-12 text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-base font-semibold text-slate-700">
              {t("home.mapScreen.errorLoading")}
            </p>
            {errorMessage && (
              <p className="max-w-xs text-sm text-slate-500">{errorMessage}</p>
            )}
            <button
              onClick={() => void loadData()}
              className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              {t("home.mapScreen.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
