import test from "node:test";
import assert from "node:assert/strict";
import {
  computeListingQualityScore,
  isSectionBackedByMobileStatus,
  mapSectionToStatus
} from "../src/listing-management.ts";

test("maps listing management sections to supported statuses", () => {
  assert.equal(mapSectionToStatus("active"), "available");
  assert.equal(mapSectionToStatus("drafts"), "draft");
  assert.equal(mapSectionToStatus("sold"), "reserved");
  assert.equal(mapSectionToStatus("expired"), "inactive");
  assert.equal(mapSectionToStatus("pending"), null);
  assert.equal(mapSectionToStatus("rejected"), null);
});

test("identifies sections backed by mobile statuses", () => {
  assert.equal(isSectionBackedByMobileStatus("active"), true);
  assert.equal(isSectionBackedByMobileStatus("drafts"), true);
  assert.equal(isSectionBackedByMobileStatus("sold"), true);
  assert.equal(isSectionBackedByMobileStatus("expired"), true);
  assert.equal(isSectionBackedByMobileStatus("pending"), false);
  assert.equal(isSectionBackedByMobileStatus("rejected"), false);
});

test("computes listing quality score with mobile-aligned checkpoints", () => {
  const score = computeListingQualityScore({
    title: "Toyota Camry 2024 full option",
    description: "Excellent condition, first owner, full service history included.",
    imageCount: 6,
    hasCategory: true,
    hasOfferType: true,
    hasPrice: true,
    hasCarLocation: true,
    isCarSaleCategory: true
  });
  assert.equal(score, 100);
});
