import { createGoogleMapsStaticPreviewUrl } from "@sanany/shared";
import { getMobileGoogleMapsApiKey } from "../config/env";

const WORLD_TILE_SIZE = 256;
const DEFAULT_MAP_ZOOM = 13;
const MAX_LATITUDE = 85.05112878;

function clampLatitude(value: number) {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, value));
}

function normalizeLongitude(value: number) {
  let longitude = value;
  while (longitude < -180) {
    longitude += 360;
  }
  while (longitude > 180) {
    longitude -= 360;
  }
  return longitude;
}

function longitudeToWorldX(longitude: number, zoom: number) {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  return ((normalizeLongitude(longitude) + 180) / 360) * worldSize;
}

function latitudeToWorldY(latitude: number, zoom: number) {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  const clampedLatitude = clampLatitude(latitude);
  const sinLatitude = Math.sin((clampedLatitude * Math.PI) / 180);
  return (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * worldSize;
}

function worldXToLongitude(worldX: number, zoom: number) {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  return normalizeLongitude((worldX / worldSize) * 360 - 180);
}

function worldYToLatitude(worldY: number, zoom: number) {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  const latitudeRadians = Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / worldSize)));
  return clampLatitude((latitudeRadians * 180) / Math.PI);
}

type GoogleGeocodeComponent = {
  long_name?: string;
  types?: string[];
};

type GoogleGeocodeResult = {
  address_components?: GoogleGeocodeComponent[];
  formatted_address?: string;
};

function pickAddressComponent(result: GoogleGeocodeResult, preferredTypes: string[]) {
  for (const preferredType of preferredTypes) {
    const match = result.address_components?.find((component) => component.types?.includes(preferredType));
    if (typeof match?.long_name === "string" && match.long_name.trim().length > 0) {
      return match.long_name.trim();
    }
  }
  return "";
}

function formatReverseGeocodeLabel(payload: unknown) {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown[] }).results)) {
    return "";
  }

  const firstResult = ((payload as { results: unknown[] }).results[0] ?? null) as GoogleGeocodeResult | null;
  if (!firstResult) {
    return "";
  }

  const primary = pickAddressComponent(firstResult, ["neighborhood", "sublocality_level_1", "route", "administrative_area_level_2", "locality"]);
  const secondary = pickAddressComponent(firstResult, ["locality", "administrative_area_level_1", "country"]);
  const parts = [primary, secondary].filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
  if (parts.length > 0) {
    return parts.join("، ");
  }

  if (typeof firstResult.formatted_address === "string" && firstResult.formatted_address.trim().length > 0) {
    return firstResult.formatted_address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("، ");
  }

  return "";
}

export function createStaticMapPreviewUrl(latitude: number, longitude: number) {
  return createGoogleMapsStaticPreviewUrl({
    apiKey: getMobileGoogleMapsApiKey(),
    latitude,
    longitude,
    zoom: DEFAULT_MAP_ZOOM
  });
}

export function translateMapPressToCoordinates(input: {
  centerLatitude: number;
  centerLongitude: number;
  height: number;
  pressX: number;
  pressY: number;
  width: number;
  zoom?: number;
}) {
  const zoom = input.zoom ?? DEFAULT_MAP_ZOOM;
  const centerWorldX = longitudeToWorldX(input.centerLongitude, zoom);
  const centerWorldY = latitudeToWorldY(input.centerLatitude, zoom);
  const nextWorldX = centerWorldX + (input.pressX - input.width / 2);
  const nextWorldY = centerWorldY + (input.pressY - input.height / 2);

  return {
    latitude: worldYToLatitude(nextWorldY, zoom),
    longitude: worldXToLongitude(nextWorldX, zoom)
  };
}

export async function reverseGeocodeLocation(input: { language: string; latitude: number; longitude: number }) {
  const params = new URLSearchParams({
    latlng: `${input.latitude},${input.longitude}`,
    language: input.language,
    region: "SA",
    key: getMobileGoogleMapsApiKey()
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const status = (payload as { status?: unknown }).status;
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    throw new Error(`Google reverse geocoding failed with status ${String(status ?? "UNKNOWN")}`);
  }
  return formatReverseGeocodeLabel(payload);
}
