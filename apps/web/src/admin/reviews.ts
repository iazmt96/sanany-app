import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/server";
import { recordAdminAuditEvent } from "./audit-events";

export type AdminReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  sellerId: string;
  sellerDisplayName: string;
  raterId: string;
  raterDisplayName: string;
  listingId: string | null;
  listingTitle: string | null;
  createdAt: string;
};

export type AdminReviewsPageData = {
  rows: AdminReviewRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  errorCode: string | null;
};

export type AdminReviewDetails = {
  row: AdminReviewRow;
  seller: {
    id: string;
    city: string | null;
    joinedAt: string | null;
  };
  rater: {
    id: string;
    city: string | null;
    joinedAt: string | null;
  };
  listing: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
  } | null;
};

export type AdminReviewsFilters = {
  q?: string | null;
  minRating?: string | null;
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

function parseMinRating(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }
  return parsed;
}

export async function getAdminReviewsPageData(filters: AdminReviewsFilters): Promise<AdminReviewsPageData> {
  const supabase = await createClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = filters.q?.trim() ?? "";
  const minRating = parseMinRating(filters.minRating);

  let query = supabase
    .from("ratings")
    .select("id,seller_id,rater_id,listing_id,rating,comment,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (minRating !== null) {
    query = query.gte("rating", minRating);
  }
  if (q.length > 0) {
    query = query.ilike("comment", `%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    return {
      rows: [],
      totalItems: 0,
      page,
      pageSize,
      totalPages: 1,
      errorCode: error.code ?? "unknown"
    };
  }

  const rows = data ?? [];
  const profileIds = Array.from(new Set(rows.flatMap((row) => [row.seller_id, row.rater_id])));
  const listingIds = Array.from(new Set(rows.map((row) => row.listing_id).filter((value): value is string => typeof value === "string")));

  const [profilesResult, listingsResult] = await Promise.all([
    profileIds.length > 0 ? supabase.from("profiles").select("id,display_name,username").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
    listingIds.length > 0 ? supabase.from("listings").select("id,title").in("id", listingIds) : Promise.resolve({ data: [], error: null })
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item]));
  const listingMap = new Map((listingsResult.data ?? []).map((item) => [item.id, item]));
  const totalItems = count ?? 0;

  return {
    rows: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      sellerId: row.seller_id,
      sellerDisplayName: profileMap.get(row.seller_id)?.display_name ?? profileMap.get(row.seller_id)?.username ?? row.seller_id,
      raterId: row.rater_id,
      raterDisplayName: profileMap.get(row.rater_id)?.display_name ?? profileMap.get(row.rater_id)?.username ?? row.rater_id,
      listingId: row.listing_id,
      listingTitle: row.listing_id ? listingMap.get(row.listing_id)?.title ?? row.listing_id : null,
      createdAt: row.created_at
    })),
    totalItems,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    errorCode: null
  };
}

export async function getAdminReviewDetails(reviewId: string): Promise<AdminReviewDetails | null> {
  const supabase = await createClient();
  const { data: review, error } = await supabase
    .from("ratings")
    .select("id,seller_id,rater_id,listing_id,rating,comment,created_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !review) {
    return null;
  }

  const [profilesResult, listingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,username,city,joined_at")
      .in("id", [review.seller_id, review.rater_id]),
    review.listing_id
      ? supabase.from("listings").select("id,title,status,created_at").eq("id", review.listing_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item]));
  const sellerProfile = profileMap.get(review.seller_id);
  const raterProfile = profileMap.get(review.rater_id);

  return {
    row: {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      sellerId: review.seller_id,
      sellerDisplayName: sellerProfile?.display_name ?? sellerProfile?.username ?? review.seller_id,
      raterId: review.rater_id,
      raterDisplayName: raterProfile?.display_name ?? raterProfile?.username ?? review.rater_id,
      listingId: review.listing_id,
      listingTitle: listingResult.data?.title ?? review.listing_id,
      createdAt: review.created_at
    },
    seller: {
      id: review.seller_id,
      city: sellerProfile?.city ?? null,
      joinedAt: sellerProfile?.joined_at ?? null
    },
    rater: {
      id: review.rater_id,
      city: raterProfile?.city ?? null,
      joinedAt: raterProfile?.joined_at ?? null
    },
    listing: listingResult.data
      ? {
          id: listingResult.data.id,
          title: listingResult.data.title ?? listingResult.data.id,
          status: listingResult.data.status ?? "unknown",
          createdAt: listingResult.data.created_at
        }
      : null
  };
}

export async function deleteAdminReview(input: { reviewId: string; actorUserId: string }): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const existingResult = await adminClient
    .from("ratings")
    .select("id,seller_id,listing_id,rating")
    .eq("id", input.reviewId)
    .maybeSingle();
  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }
  if (!existingResult.data) {
    throw new Error("Review was not found.");
  }

  const { error } = await adminClient.from("ratings").delete().eq("id", input.reviewId);
  if (error) {
    throw new Error(error.message);
  }

  await recordAdminAuditEvent({
    actorUserId: input.actorUserId,
    eventType: "review_deleted",
    targetUserId: existingResult.data.seller_id,
    targetListingId: existingResult.data.listing_id,
    targetReviewId: existingResult.data.id,
    metadata: {
      rating: existingResult.data.rating
    }
  });
}
