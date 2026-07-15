import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPreferences,
  serializeNotificationPreferences,
  toListingStatusFilterForProfileView
} from "../src/profile-rules.ts";

test("maps profile listing views to listing status filters", () => {
  assert.equal(toListingStatusFilterForProfileView("active"), "available");
  assert.equal(toListingStatusFilterForProfileView("drafts"), "draft");
  assert.equal(toListingStatusFilterForProfileView("sold"), "sold");
  assert.equal(toListingStatusFilterForProfileView("expired"), "inactive");
  assert.equal(toListingStatusFilterForProfileView("favorites"), null);
});

test("parses notification preferences with safe defaults", () => {
  assert.deepEqual(parseNotificationPreferences(null), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(parseNotificationPreferences("{\"marketing\":false}"), {
    marketing: false,
    messages: true,
    listingUpdates: true
  });
  assert.deepEqual(parseNotificationPreferences("invalid-json"), DEFAULT_NOTIFICATION_PREFERENCES);
});

test("serializes notification preferences", () => {
  const encoded = serializeNotificationPreferences({
    marketing: false,
    messages: true,
    listingUpdates: false
  });
  assert.equal(encoded, "{\"marketing\":false,\"messages\":true,\"listingUpdates\":false}");
});
