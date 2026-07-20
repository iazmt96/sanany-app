import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleMapsSearchUrl, createGoogleMapsStaticPreviewUrl } from "../src/google-maps.ts";

test("builds a Google static maps preview url", () => {
  const url = createGoogleMapsStaticPreviewUrl({
    apiKey: "demo-key",
    latitude: 24.7136,
    longitude: 46.6753
  });

  assert.equal(
    url,
    "https://maps.googleapis.com/maps/api/staticmap?center=24.7136%2C46.6753&zoom=13&size=640x420&scale=2&markers=color%3Ared%7C24.7136%2C46.6753&key=demo-key"
  );
});

test("builds a Google maps search url from coordinates or custom query", () => {
  assert.equal(
    createGoogleMapsSearchUrl({
      latitude: 24.7136,
      longitude: 46.6753
    }),
    "https://www.google.com/maps/search/?api=1&query=24.7136%2C46.6753"
  );

  assert.equal(
    createGoogleMapsSearchUrl({
      latitude: 24.7136,
      longitude: 46.6753,
      query: "Riyadh"
    }),
    "https://www.google.com/maps/search/?api=1&query=Riyadh"
  );
});
