const DEFAULT_GOOGLE_MAPS_ZOOM = 13;
const DEFAULT_STATIC_MAP_WIDTH = 640;
const DEFAULT_STATIC_MAP_HEIGHT = 420;
const DEFAULT_STATIC_MAP_SCALE = 2;

type GoogleMapsStaticPreviewInput = {
  apiKey: string;
  height?: number;
  latitude: number;
  longitude: number;
  scale?: number;
  width?: number;
  zoom?: number;
};

export function createGoogleMapsStaticPreviewUrl(input: GoogleMapsStaticPreviewInput) {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("Missing Google Maps API key.");
  }

  const width = input.width ?? DEFAULT_STATIC_MAP_WIDTH;
  const height = input.height ?? DEFAULT_STATIC_MAP_HEIGHT;
  const zoom = input.zoom ?? DEFAULT_GOOGLE_MAPS_ZOOM;
  const scale = input.scale ?? DEFAULT_STATIC_MAP_SCALE;
  const center = `${input.latitude},${input.longitude}`;
  const params = new URLSearchParams({
    center,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: String(scale),
    markers: `color:red|${input.latitude},${input.longitude}`,
    key: apiKey
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export function createGoogleMapsSearchUrl(input: { latitude: number; longitude: number; query?: string | null }) {
  const query = input.query?.trim();
  const destination = query && query.length > 0 ? query : `${input.latitude},${input.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}
