import test from "node:test";
import assert from "node:assert/strict";
import type { MarketplaceListing } from "@sanany/types";
import {
  countActiveListingsFilters,
  matchesListingsFilters,
  normalizeListingsFilters,
  parseListingsQueryFromParams,
  toListingsQueryParams
} from "../src/search-filters.ts";

const baseListing: MarketplaceListing = {
  id: "1",
  ownerId: "u1",
  ownerPhone: "0500000000",
  title: "Toyota Camry 2023",
  description: "سيارة مستعملة بحالة ممتازة بنزين للبيع",
  price: 78000,
  status: "available",
  imageUrl: null,
  locationName: "الرياض",
  latitude: null,
  longitude: null,
  createdAt: new Date().toISOString()
};

test("normalizes price range and car-only filters", () => {
  const normalized = normalizeListingsFilters({
    category: "serviceOffer",
    minPrice: 90000,
    maxPrice: 1000,
    carCondition: "used",
    city: "riyadh"
  });

  assert.equal(normalized?.minPrice, 1000);
  assert.equal(normalized?.maxPrice, 90000);
  assert.equal(normalized?.city, "riyadh");
  assert.equal(normalized?.carCondition, undefined);
});

test("parses and serializes URL query params", () => {
  const input = new URLSearchParams(
    "q=toyota&status=available&sort=priceLow&page=3&category=carSale&city=riyadh&minPrice=10000&maxPrice=90000&brand=toyota&year=2023"
  );
  const query = parseListingsQueryFromParams(input, 12);
  const params = toListingsQueryParams(query);

  assert.equal(query.search, "toyota");
  assert.equal(query.page, 3);
  assert.equal(query.filters?.category, "carSale");
  assert.equal(params.get("brand"), "toyota");
  assert.equal(params.get("year"), "2023");
});

test("counts active filters", () => {
  const count = countActiveListingsFilters({
    city: "riyadh",
    category: "carSale",
    minPrice: 1
  });
  assert.equal(count, 3);
});

test("matches listing against selected filters", () => {
  assert.equal(matchesListingsFilters(baseListing, { city: "riyadh", category: "carSale", brand: "Toyota", year: "2023" }), true);
  assert.equal(matchesListingsFilters(baseListing, { city: "jeddah" }), false);
  assert.equal(matchesListingsFilters(baseListing, { minPrice: 80000 }), false);
});
