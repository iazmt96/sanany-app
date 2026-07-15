import type {
  ListingSalePayment,
  ListingSalePaymentStatus,
  ListingStatus,
  MarketplaceCommissionSettings,
  MarketplaceListing
} from "@sanany/types";

export const DEFAULT_MARKETPLACE_COMMISSION_RATE_PERCENT = 1;
export const DEFAULT_MARKETPLACE_PAYMENT_METHOD = "digital_checkout";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCommissionFromSaleAmount(input: {
  finalSaleAmount: number;
  commissionRatePercent: number;
}): {
  finalSaleAmount: number;
  commissionRatePercent: number;
  commissionAmount: number;
  totalToPayNow: number;
} {
  const finalSaleAmount = roundMoney(Math.max(0, input.finalSaleAmount));
  const commissionRatePercent = roundMoney(Math.max(0, input.commissionRatePercent));
  const commissionAmount = roundMoney((finalSaleAmount * commissionRatePercent) / 100);

  return {
    finalSaleAmount,
    commissionRatePercent,
    commissionAmount,
    totalToPayNow: commissionAmount
  };
}

export function isListingActiveForSaleCompletion(status: ListingStatus): boolean {
  return status === "available" || status === "reserved";
}

export function isTerminalSalePaymentStatus(status: ListingSalePaymentStatus): boolean {
  return status === "paid" || status === "refunded";
}

export function getListingSalePaymentByListingId(payments: ListingSalePayment[], listingId: string): ListingSalePayment | null {
  return payments.find((payment) => payment.listingId === listingId) ?? null;
}

export function hasPaidSaleCompletion(payments: ListingSalePayment[], listingId: string): boolean {
  const payment = getListingSalePaymentByListingId(payments, listingId);
  return payment?.paymentStatus === "paid";
}

export function buildDefaultCommissionSettings(): MarketplaceCommissionSettings {
  return {
    commissionRatePercent: DEFAULT_MARKETPLACE_COMMISSION_RATE_PERCENT,
    updatedAt: new Date(0).toISOString()
  };
}

export function shouldShowSaleCompletionAction(listing: MarketplaceListing, payments: ListingSalePayment[]): boolean {
  if (!isListingActiveForSaleCompletion(listing.status)) {
    return false;
  }

  const payment = getListingSalePaymentByListingId(payments, listing.id);
  return payment?.paymentStatus !== "paid";
}
