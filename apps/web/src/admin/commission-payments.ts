import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { ListingSalePaymentStatus, ListingSaleSource } from "@sanany/types";
import { createClient } from "../../utils/supabase/server";

const COMMISSION_PAYMENT_FILTER_STATUSES = ["pending", "paid", "failed", "cancelled", "refunded"] as const;
type CommissionPaymentFilterStatus = (typeof COMMISSION_PAYMENT_FILTER_STATUSES)[number];

export type AdminCommissionPaymentRow = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImageUrl: string | null;
  sellerId: string;
  sellerDisplayName: string;
  sellerUsername: string | null;
  saleSource: ListingSaleSource;
  saleSourceOther: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  listingCategorySlug: string | null;
  listingCreatedAt: string | null;
  soldAt: string | null;
  finalSaleAmount: number;
  commissionRatePercent: number;
  commissionAmount: number;
  paymentStatus: ListingSalePaymentStatus;
  paymentDate: string | null;
  invoiceNumber: string | null;
  transactionReference: string | null;
  paymentMethod: string | null;
  refundReason: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCommissionPaymentsData = {
  rows: AdminCommissionPaymentRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentRatePercent: number;
  analytics: {
    totalRevenue: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    revenueYear: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
    cancelledCount: number;
    averageSaleAmount: number;
    averageCommissionAmount: number;
    averageSellingHours: number | null;
    conversionRatePublishedToSold: number;
    topSellers: Array<{ sellerId: string; sellerName: string; totalCommission: number; paidSalesCount: number }>;
    highestCommission: { paymentId: string; listingTitle: string; sellerName: string; commissionAmount: number } | null;
    topCategories: Array<{ categorySlug: string; soldCount: number; averageSaleAmount: number; averageCommissionAmount: number }>;
  };
};

export type AdminCommissionPaymentsFilters = {
  q?: string | null;
  status?: string | null;
  page?: string | null;
};

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseStatus(value: string | null | undefined): CommissionPaymentFilterStatus | null {
  return COMMISSION_PAYMENT_FILTER_STATUSES.find((status) => status === value) ?? null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getAdminCommissionPaymentsData(filters: AdminCommissionPaymentsFilters): Promise<AdminCommissionPaymentsData> {
  const adminClient = requireServiceRoleClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = filters.q?.trim() ?? "";
  const statusFilter = parseStatus(filters.status);

  let paymentsQuery = adminClient
    .from("listing_sale_payments")
    .select(
      "id,listing_id,seller_id,sale_source,sale_source_other,buyer_name,buyer_phone,final_sale_amount,commission_rate_percent,commission_amount,payment_status,payment_date,invoice_number,transaction_reference,payment_method,refund_reason,failure_reason,created_at,updated_at,listings!listing_sale_payments_listing_id_fkey(id,title,image_url,category_slug,created_at,status),profiles!listing_sale_payments_seller_id_fkey(id,display_name,username)",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (statusFilter) {
    paymentsQuery = paymentsQuery.eq("payment_status", statusFilter);
  }

  if (q.length > 0) {
    const ownerPattern = `%${q}%`;
    const isDirectUuid = isUuid(q);
    const [listingMatches, sellerMatches] = await Promise.all([
      adminClient
        .from("listings")
        .select("id")
        .or(isDirectUuid ? `title.ilike.${ownerPattern},id.eq.${q}` : `title.ilike.${ownerPattern}`)
        .limit(50),
      adminClient
        .from("profiles")
        .select("id")
        .or(isDirectUuid ? `display_name.ilike.${ownerPattern},username.ilike.${ownerPattern},id.eq.${q}` : `display_name.ilike.${ownerPattern},username.ilike.${ownerPattern}`)
        .limit(50)
    ]);

    const listingIds = (listingMatches.data ?? []).map((item) => item.id);
    const sellerIds = (sellerMatches.data ?? []).map((item) => item.id);
    const orSegments = [`invoice_number.ilike.%${q}%`, `transaction_reference.ilike.%${q}%`];
    if (listingIds.length > 0) {
      orSegments.push(`listing_id.in.(${listingIds.join(",")})`);
    }
    if (sellerIds.length > 0) {
      orSegments.push(`seller_id.in.(${sellerIds.join(",")})`);
    }
    paymentsQuery = paymentsQuery.or(orSegments.join(","));
  }

  const { data, count, error } = await paymentsQuery;
  if (error) {
    throw new Error(error.message);
  }

  const [settingsResult, analyticsResult] = await Promise.all([
    adminClient.from("marketplace_commission_settings").select("commission_rate_percent").eq("id", true).maybeSingle(),
    adminClient
      .from("listing_sale_payments")
      .select("id,payment_status,payment_date,commission_amount,final_sale_amount,seller_id,sale_source,sale_source_other,buyer_name,buyer_phone,listings!listing_sale_payments_listing_id_fkey(id,title,category_slug,created_at)")
      .limit(5000)
  ]);

  if (settingsResult.error) {
    throw new Error(settingsResult.error.message);
  }
  if (analyticsResult.error) {
    throw new Error(analyticsResult.error.message);
  }

  const analytics = {
    totalRevenue: 0,
    revenueToday: 0,
    revenueWeek: 0,
    revenueMonth: 0,
    revenueYear: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
    cancelledCount: 0,
    averageSaleAmount: 0,
    averageCommissionAmount: 0,
    averageSellingHours: null as number | null,
    conversionRatePublishedToSold: 0,
    topSellers: [] as Array<{ sellerId: string; sellerName: string; totalCommission: number; paidSalesCount: number }>,
    highestCommission: null as { paymentId: string; listingTitle: string; sellerName: string; commissionAmount: number } | null,
    topCategories: [] as Array<{ categorySlug: string; soldCount: number; averageSaleAmount: number; averageCommissionAmount: number }>
  };
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  let paidSaleAmountSum = 0;
  let paidCommissionSum = 0;
  let paidSellingHoursSum = 0;
  let paidSellingHoursCount = 0;
  const sellerBuckets = new Map<string, { sellerName: string; totalCommission: number; paidSalesCount: number }>();
  const categoryBuckets = new Map<string, { soldCount: number; saleSum: number; commissionSum: number }>();
  const paidListingIds = new Set<string>();
  const paidSellerNames = new Map<string, string>();

  for (const row of analyticsResult.data ?? []) {
    const status = row.payment_status as ListingSalePaymentStatus;
    if (status === "paid") {
      const paidAtMs = row.payment_date ? new Date(row.payment_date).getTime() : Number.NaN;
      const commissionAmount = Number(row.commission_amount ?? 0);
      const saleAmount = Number(row.final_sale_amount ?? 0);
      analytics.paidCount += 1;
      analytics.totalRevenue += commissionAmount;
      paidSaleAmountSum += saleAmount;
      paidCommissionSum += commissionAmount;
      if (!Number.isNaN(paidAtMs)) {
        if (paidAtMs >= dayStart) analytics.revenueToday += commissionAmount;
        if (paidAtMs >= weekStart) analytics.revenueWeek += commissionAmount;
        if (paidAtMs >= monthStart) analytics.revenueMonth += commissionAmount;
        if (paidAtMs >= yearStart) analytics.revenueYear += commissionAmount;
      }
      const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
      const sellerId = String(row.seller_id ?? "");
      const sellerName = sellerId;
      if (sellerId) {
        const sellerBucket = sellerBuckets.get(sellerId) ?? { sellerName, totalCommission: 0, paidSalesCount: 0 };
        sellerBucket.totalCommission += commissionAmount;
        sellerBucket.paidSalesCount += 1;
        sellerBuckets.set(sellerId, sellerBucket);
      }
      if (listing?.id) {
        paidListingIds.add(listing.id);
      }
      const categorySlug = listing?.category_slug ?? "uncategorized";
      const categoryBucket = categoryBuckets.get(categorySlug) ?? { soldCount: 0, saleSum: 0, commissionSum: 0 };
      categoryBucket.soldCount += 1;
      categoryBucket.saleSum += saleAmount;
      categoryBucket.commissionSum += commissionAmount;
      categoryBuckets.set(categorySlug, categoryBucket);
      const listingCreatedAtMs = listing?.created_at ? new Date(listing.created_at).getTime() : Number.NaN;
      if (!Number.isNaN(listingCreatedAtMs) && !Number.isNaN(paidAtMs) && paidAtMs >= listingCreatedAtMs) {
        paidSellingHoursSum += (paidAtMs - listingCreatedAtMs) / (1000 * 60 * 60);
        paidSellingHoursCount += 1;
      }
      if (!analytics.highestCommission || commissionAmount > analytics.highestCommission.commissionAmount) {
        analytics.highestCommission = {
          paymentId: row.id,
          listingTitle: listing?.title?.trim() || listing?.id || row.id,
          sellerName,
          commissionAmount
        };
      }
    } else if (status === "pending") {
      analytics.pendingCount += 1;
    } else if (status === "failed") {
      analytics.failedCount += 1;
    } else if (status === "refunded") {
      analytics.refundedCount += 1;
    } else if (status === "cancelled") {
      analytics.cancelledCount += 1;
    }
  }
  const [publishedListingsResult, sellerProfilesResult] = await Promise.all([
    adminClient
      .from("listings")
      .select("id", { count: "exact", head: true })
      .in("status", ["available", "reserved", "sold", "inactive"]),
    adminClient.from("profiles").select("id,display_name,username").in("id", Array.from(sellerBuckets.keys()))
  ]);
  if (publishedListingsResult.error) {
    throw new Error(publishedListingsResult.error.message);
  }
  if (sellerProfilesResult.error) {
    throw new Error(sellerProfilesResult.error.message);
  }
  for (const seller of sellerProfilesResult.data ?? []) {
    const name = seller.display_name?.trim() || seller.username || seller.id;
    paidSellerNames.set(seller.id, name);
  }
  if (analytics.highestCommission && sellerBuckets.has(analytics.highestCommission.sellerName)) {
    const mappedName = paidSellerNames.get(analytics.highestCommission.sellerName);
    if (mappedName) {
      analytics.highestCommission = {
        ...analytics.highestCommission,
        sellerName: mappedName
      };
    }
  }
  analytics.averageSaleAmount = analytics.paidCount > 0 ? paidSaleAmountSum / analytics.paidCount : 0;
  analytics.averageCommissionAmount = analytics.paidCount > 0 ? paidCommissionSum / analytics.paidCount : 0;
  analytics.averageSellingHours = paidSellingHoursCount > 0 ? paidSellingHoursSum / paidSellingHoursCount : null;
  const publishedListingsCount = publishedListingsResult.count ?? 0;
  analytics.conversionRatePublishedToSold = publishedListingsCount > 0 ? (analytics.paidCount / publishedListingsCount) * 100 : 0;
  analytics.topSellers = Array.from(sellerBuckets.entries())
    .map(([sellerId, bucket]) => ({
      sellerId,
      sellerName: paidSellerNames.get(sellerId) ?? bucket.sellerName,
      totalCommission: bucket.totalCommission,
      paidSalesCount: bucket.paidSalesCount
    }))
    .sort((a, b) => b.totalCommission - a.totalCommission)
    .slice(0, 5);
  analytics.topCategories = Array.from(categoryBuckets.entries())
    .map(([categorySlug, bucket]) => ({
      categorySlug,
      soldCount: bucket.soldCount,
      averageSaleAmount: bucket.soldCount > 0 ? bucket.saleSum / bucket.soldCount : 0,
      averageCommissionAmount: bucket.soldCount > 0 ? bucket.commissionSum / bucket.soldCount : 0
    }))
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, 5);

  const rows = (data ?? []).map((row) => {
    const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
    const seller = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      listingId: row.listing_id,
      listingTitle: listing?.title?.trim() || row.listing_id,
      listingImageUrl: listing?.image_url ?? null,
      sellerId: row.seller_id,
      sellerDisplayName: seller?.display_name?.trim() || seller?.username || row.seller_id,
      sellerUsername: seller?.username ?? null,
      saleSource: row.sale_source as ListingSaleSource,
      saleSourceOther: row.sale_source_other ?? null,
      buyerName: row.buyer_name ?? null,
      buyerPhone: row.buyer_phone ?? null,
      listingCategorySlug: listing?.category_slug ?? null,
      listingCreatedAt: listing?.created_at ?? null,
      soldAt: row.payment_date ?? null,
      finalSaleAmount: Number(row.final_sale_amount ?? 0),
      commissionRatePercent: Number(row.commission_rate_percent ?? 0),
      commissionAmount: Number(row.commission_amount ?? 0),
      paymentStatus: row.payment_status as ListingSalePaymentStatus,
      paymentDate: row.payment_date ?? null,
      invoiceNumber: row.invoice_number ?? null,
      transactionReference: row.transaction_reference ?? null,
      paymentMethod: row.payment_method ?? null,
      refundReason: row.refund_reason ?? null,
      failureReason: row.failure_reason ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });

  const totalItems = count ?? 0;
  return {
    rows,
    totalItems,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    currentRatePercent: Number(settingsResult.data?.commission_rate_percent ?? 1),
    analytics
  };
}

export async function updateMarketplaceCommissionRate(input: { ratePercent: number; actorUserId: string }): Promise<void> {
  if (!Number.isFinite(input.ratePercent) || input.ratePercent <= 0 || input.ratePercent > 100) {
    throw new Error("Commission rate must be between 0 and 100.");
  }

  const adminClient = requireServiceRoleClient();
  const { error } = await adminClient
    .from("marketplace_commission_settings")
    .upsert({
      id: true,
      commission_rate_percent: Number(input.ratePercent.toFixed(2)),
      updated_by: input.actorUserId
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function refundCommissionPayment(input: {
  paymentId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Refund reason is required.");
  }

  const { data: payment, error: paymentError } = await adminClient
    .from("listing_sale_payments")
    .select("id,payment_status")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (paymentError) {
    throw new Error(paymentError.message);
  }
  if (!payment) {
    throw new Error("Commission payment was not found.");
  }
  if (payment.payment_status !== "paid") {
    throw new Error("Only paid commission payments can be refunded.");
  }

  const { error } = await adminClient
    .from("listing_sale_payments")
    .update({
      payment_status: "refunded",
      refund_reason: reason,
      refunded_at: new Date().toISOString()
    })
    .eq("id", input.paymentId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentAdminUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
