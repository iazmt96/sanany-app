import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCommissionFromSaleAmount,
  isListingActiveForSaleCompletion,
  shouldShowSaleCompletionAction
} from "../src/commission.ts";

test("calculates 1 percent commission and payable total", () => {
  const result = calculateCommissionFromSaleAmount({
    finalSaleAmount: 50000,
    commissionRatePercent: 1
  });

  assert.deepEqual(result, {
    finalSaleAmount: 50000,
    commissionRatePercent: 1,
    commissionAmount: 500,
    totalToPayNow: 500,
    sellerNetAmount: 49500
  });
});

test("treats available and reserved listings as active for sale completion", () => {
  assert.equal(isListingActiveForSaleCompletion("available"), true);
  assert.equal(isListingActiveForSaleCompletion("reserved"), true);
  assert.equal(isListingActiveForSaleCompletion("sold"), false);
});

test("hides sale completion action after a paid commission payment exists", () => {
  const listing = {
    id: "listing-paid",
    ownerId: "seller-1",
    ownerPhone: null,
    title: "Mercedes GLC",
    description: null,
    price: 120000,
    status: "available" as const,
    imageUrl: null,
    locationName: "Riyadh",
    latitude: null,
    longitude: null,
    createdAt: new Date().toISOString()
  };

  assert.equal(
    shouldShowSaleCompletionAction(listing, [
      {
        id: "payment-1",
        listingId: "listing-paid",
        sellerId: "seller-1",
        saleSource: "outside_sanany",
        saleSourceOther: null,
        finalSaleAmount: 118000,
        commissionRatePercent: 1,
        commissionAmount: 1180,
        buyerName: null,
        buyerPhone: null,
        paymentStatus: "paid",
        paymentMethod: "digital_checkout",
        paymentDate: new Date().toISOString(),
        invoiceNumber: "SAN-INV-1",
        transactionReference: "SAN-TXN-1",
        failureReason: null,
        refundReason: null,
        refundedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]),
    false
  );
});
