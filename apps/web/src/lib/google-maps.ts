import { createGoogleMapsStaticPreviewUrl } from "@sanany/shared";
import { getWebGoogleMapsApiKey } from "../config/env";

declare global {
  interface Window {
    google?: any;
    __sananyGoogleMapsReady__?: () => void;
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "sanany-google-maps-script";
let googleMapsPromise: Promise<any> | null = null;

export function createWebStaticMapPreviewUrl(latitude: number, longitude: number) {
  return createGoogleMapsStaticPreviewUrl({
    apiKey: getWebGoogleMapsApiKey(),
    latitude,
    longitude
  });
}

export function loadGoogleMapsApi() {
  if (typeof window === "undefined") {
    throw new Error("Google Maps can only load in the browser.");
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    const handleReady = () => {
      if (!window.google?.maps) {
        reject(new Error("Google Maps API loaded without maps namespace."));
        return;
      }
      resolve(window.google.maps);
    };

    if (existingScript) {
      if (window.google?.maps) {
        handleReady();
        return;
      }

      existingScript.addEventListener("load", handleReady, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps API.")), { once: true });
      return;
    }

    const callbackName = "__sananyGoogleMapsReady__";
    window[callbackName] = () => {
      handleReady();
      delete window[callbackName];
    };

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(getWebGoogleMapsApiKey())}&callback=${callbackName}&v=weekly`;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error("Failed to load Google Maps API."));
    };
    document.body.appendChild(script);
  });

  return googleMapsPromise;
}
