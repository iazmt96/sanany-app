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

function pickAddressPart(address: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function formatReverseGeocodeLabel(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const address = (payload as { address?: Record<string, unknown> }).address ?? {};
  const primary = pickAddressPart(address, ["neighbourhood", "suburb", "city_district", "road", "town", "village"]);
  const secondary = pickAddressPart(address, ["city", "state"]);
  const parts = [primary, secondary].filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
  if (parts.length > 0) {
    return parts.join("، ");
  }

  const displayName = (payload as { display_name?: unknown }).display_name;
  if (typeof displayName === "string" && displayName.trim().length > 0) {
    return displayName
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("، ");
  }

  return "";
}

export function createStaticMapPreviewUrl(latitude: number, longitude: number) {
  return `https://static-maps.yandex.ru/1.x/?ll=${longitude},${latitude}&z=${DEFAULT_MAP_ZOOM}&l=map&size=900,420&pt=${longitude},${latitude},pm2rdm`;
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
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${input.latitude}&lon=${input.longitude}&zoom=16&accept-language=${encodeURIComponent(input.language)}`
  );
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  return formatReverseGeocodeLabel(payload);
}
