import type { ListingSaleInvoice, ListingSalePayment, MarketplaceCommissionSettings, MarketplaceListing } from "@sanany/types";

export type CommissionReviewPreviewState = "active" | "calculator" | "confirmation" | "loading" | "failed" | "success" | "invoice" | "sold";
export type CommissionReviewModalState = "idle" | "pending" | "failed" | "cancelled" | "success";

export type CommissionReviewPreviewData = {
  sellerId: string;
  settings: MarketplaceCommissionSettings;
  listings: MarketplaceListing[];
  payments: ListingSalePayment[];
  section: "active" | "sold";
  selectedListingId: string | null;
  amount: string;
  isConfirmed: boolean;
  uiState: CommissionReviewModalState;
  invoice: ListingSaleInvoice | null;
};

const PREVIEW_SELLER_ID = "preview-seller-sanany";
const ACTIVE_LISTING_ID = "preview-listing-active";
const SOLD_LISTING_ID = "preview-listing-sold";
const PREVIEW_IMAGE_URL = "/brand/sanany-logo.png";

function buildActiveListing(language: string): MarketplaceListing {
  return {
    id: ACTIVE_LISTING_ID,
    ownerId: PREVIEW_SELLER_ID,
    ownerPhone: "+966551234567",
    offerType: "sell",
    categorySlug: "carSale",
    title: language === "en" ? "Toyota Land Cruiser GXR 2023" : "تويوتا لاندكروزر GXR 2023",
    description: language === "en" ? "Single-owner SUV with full service history." : "سيارة عائلية بحالة ممتازة وسجل صيانة كامل.",
    price: 52500,
    status: "available",
    imageUrl: PREVIEW_IMAGE_URL,
    locationName: language === "en" ? "Riyadh" : "الرياض",
    latitude: 24.7136,
    longitude: 46.6753,
    createdAt: "2026-07-14T08:30:00.000Z",
    updatedAt: "2026-07-15T10:15:00.000Z"
  };
}

function buildSoldListing(language: string): MarketplaceListing {
  return {
    id: SOLD_LISTING_ID,
    ownerId: PREVIEW_SELLER_ID,
    ownerPhone: "+966551234567",
    offerType: "sell",
    categorySlug: "carSale",
    title: language === "en" ? "Lexus ES 2022" : "لكزس ES 2022",
    description: language === "en" ? "Recently sold listing preview." : "إعلان تم بيعه لعرض تبويب المبيعات.",
    price: 34000,
    status: "sold",
    imageUrl: PREVIEW_IMAGE_URL,
    locationName: language === "en" ? "Jeddah" : "جدة",
    latitude: 21.5433,
    longitude: 39.1728,
    createdAt: "2026-07-10T14:15:00.000Z",
    updatedAt: "2026-07-15T11:40:00.000Z"
  };
}

function buildPaidPayment(listingId: string): ListingSalePayment {
  return {
    id: "preview-payment-paid",
    listingId,
    sellerId: PREVIEW_SELLER_ID,
    saleSource: "sanany_chat",
    saleSourceOther: null,
    finalSaleAmount: 50000,
    commissionRatePercent: 1,
    commissionAmount: 500,
    buyerName: "مشتري سناني",
    buyerPhone: "+966500000000",
    paymentStatus: "paid",
    paymentMethod: "digital_checkout",
    paymentDate: "2026-07-15T11:40:00.000Z",
    invoiceNumber: "SAN-2026-000341",
    transactionReference: "TXN-SANANY-504881",
    failureReason: null,
    refundReason: null,
    refundedAt: null,
    createdAt: "2026-07-15T11:38:00.000Z",
    updatedAt: "2026-07-15T11:40:00.000Z"
  };
}

function buildInvoice(language: string, payment: ListingSalePayment): ListingSaleInvoice {
  return {
    payment,
    listingId: ACTIVE_LISTING_ID,
    listingTitle: language === "en" ? "Toyota Land Cruiser GXR 2023" : "تويوتا لاندكروزر GXR 2023",
    listingImageUrl: PREVIEW_IMAGE_URL,
    sellerDisplayName: language === "en" ? "SANANY Seller" : "بائع سناني",
    sellerUsername: "sananyseller"
  };
}

export function buildCommissionReviewPreview(language: string, state: CommissionReviewPreviewState): CommissionReviewPreviewData {
  const activeListing = buildActiveListing(language);
  const soldListing = buildSoldListing(language);
  const paidPayment = buildPaidPayment(SOLD_LISTING_ID);
  const successPayment = { ...buildPaidPayment(ACTIVE_LISTING_ID), id: "preview-payment-success" };
  const settings: MarketplaceCommissionSettings = {
    commissionRatePercent: 1,
    updatedAt: "2026-07-15T08:00:00.000Z"
  };

  if (state === "sold") {
    return {
      sellerId: PREVIEW_SELLER_ID,
      settings,
      listings: [{ ...activeListing, status: "sold" }, soldListing],
      payments: [{ ...successPayment, listingId: ACTIVE_LISTING_ID }, paidPayment],
      section: "sold",
      selectedListingId: null,
      amount: "50000",
      isConfirmed: true,
      uiState: "success",
      invoice: buildInvoice(language, successPayment)
    };
  }

  const invoice = state === "success" || state === "invoice" ? buildInvoice(language, successPayment) : null;
  const uiState: CommissionReviewModalState =
    state === "loading" ? "pending" : state === "failed" ? "failed" : state === "success" || state === "invoice" ? "success" : "idle";

  return {
    sellerId: PREVIEW_SELLER_ID,
    settings,
    listings: [activeListing, soldListing],
    payments: [paidPayment],
    section: "active",
    selectedListingId: state === "active" ? null : ACTIVE_LISTING_ID,
    amount: "50000",
    isConfirmed: state === "confirmation" || state === "loading" || state === "failed" || state === "success" || state === "invoice",
    uiState,
    invoice
  };
}
