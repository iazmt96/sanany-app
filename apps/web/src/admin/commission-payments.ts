import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { ListingSalePaymentStatus } from "@sanany/types";
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
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
    cancelledCount: number;
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
      "id,listing_id,seller_id,final_sale_amount,commission_rate_percent,commission_amount,payment_status,payment_date,invoice_number,transaction_reference,payment_method,refund_reason,failure_reason,created_at,updated_at,listings!listing_sale_payments_listing_id_fkey(id,title,image_url),profiles!listing_sale_payments_seller_id_fkey(id,display_name,username)",
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
      .select("payment_status,commission_amount")
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
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
    cancelledCount: 0
  };

  for (const row of analyticsResult.data ?? []) {
    const status = row.payment_status as ListingSalePaymentStatus;
    if (status === "paid") {
      analytics.paidCount += 1;
      analytics.totalRevenue += Number(row.commission_amount ?? 0);
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
