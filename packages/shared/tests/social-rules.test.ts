import test from "node:test";
import assert from "node:assert/strict";
import { canFollowSeller, canRateSeller, computeRatingDistribution } from "../src/social-rules.ts";

test("prevents self follow and self rating", () => {
  assert.equal(canFollowSeller("user-1", "user-1"), false);
  assert.equal(canRateSeller("user-1", "user-1"), false);
});

test("allows authenticated non-owner social actions", () => {
  assert.equal(canFollowSeller("user-1", "user-2"), true);
  assert.equal(canRateSeller("user-1", "user-2"), true);
});

test("builds rating distribution percentages", () => {
  const distribution = computeRatingDistribution([
    { id: "1", sellerId: "s", raterId: "a", listingId: null, rating: 5, comment: null, createdAt: "", raterName: null, raterAvatarUrl: null },
    { id: "2", sellerId: "s", raterId: "b", listingId: null, rating: 4, comment: null, createdAt: "", raterName: null, raterAvatarUrl: null },
    { id: "3", sellerId: "s", raterId: "c", listingId: null, rating: 5, comment: null, createdAt: "", raterName: null, raterAvatarUrl: null }
  ]);
  assert.deepEqual(distribution[0], { stars: 5, count: 2, percent: 67 });
  assert.deepEqual(distribution[1], { stars: 4, count: 1, percent: 33 });
  assert.deepEqual(distribution[2], { stars: 3, count: 0, percent: 0 });
});
