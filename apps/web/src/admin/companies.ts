import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/server";
import type { VerificationStatus } from "./verifications";

export type AdminCompanyRow = {
  userId: string;
  userDisplayName: string;
  username: string | null;
  companyName: string;
  representativeName: string;
  businessType: string | null;
  city: string | null;
  verificationStatus: VerificationStatus;
  listingsCount: number;
  joinedAt: string | null;
  requestedAt: string;
};

export type AdminCompanyDetails = {
  row: AdminCompanyRow;
  companyDescription: string | null;
  commercialRegistrationMasked: string;
  taxNumberMasked: string | null;
  website: string | null;
  access: {
    email: string | null;
    phone: string | null;
    lastSignInAt: string | null;
    isSuspended: boolean;
  };
  listings: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  ratings: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    raterDisplayName: string;
  }>;
};

export type AdminCompaniesPageData = {
  rows: AdminCompanyRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  errorCode: string | null;
};

export type AdminCompaniesFilters = {
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

function parseVerificationStatus(value: string | null | undefined): VerificationStatus {
  if (value === "pending" || value === "verified" || value === "rejected") {
    return value;
  }
  return "unverified";
}

function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return "***";
  }
  return `${"*".repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function toDisplayName(profile: { display_name: string | null; username: string | null } | null | undefined, fallback: string): string {
  return profile?.display_name?.trim() || profile?.username || fallback;
}

export async function getAdminCompaniesPageData(filters: AdminCompaniesFilters): Promise<AdminCompaniesPageData> {
  const supabase = await createClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("company_profiles")
    .select("user_id,company_name,representative_name,business_type,verification_status,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = filters.q?.trim();
  if (q && q.length > 0) {
    query = query.or(`company_name.ilike.%${q}%,representative_name.ilike.%${q}%,business_type.ilike.%${q}%`);
  }
  if (filters.status === "unverified" || filters.status === "pending" || filters.status === "verified" || filters.status === "rejected") {
    query = query.eq("verification_status", filters.status);
  }

  const { data, count, error } = await query;
  if (error) {
    return { rows: [], totalItems: 0, page, pageSize, totalPages: 1, errorCode: error.code ?? "unknown" };
  }

  const rows = data ?? [];
  const userIds = rows.map((row) => row.user_id);
  const [profilesResult, listingsResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id,display_name,username,city,joined_at").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0 ? supabase.from("listings").select("id,owner_id").in("owner_id", userIds) : Promise.resolve({ data: [], error: null })
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item]));
  const listingCounts = new Map<string, number>();
  for (const listing of listingsResult.data ?? []) {
    const ownerId = listing.owner_id ?? "";
    listingCounts.set(ownerId, (listingCounts.get(ownerId) ?? 0) + 1);
  }

  const totalItems = count ?? 0;
  return {
    rows: rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        userId: row.user_id,
        userDisplayName: toDisplayName(profile, row.user_id),
        username: profile?.username ?? null,
        companyName: row.company_name ?? row.user_id,
        representativeName: row.representative_name ?? "—",
        businessType: row.business_type,
        city: profile?.city ?? null,
        verificationStatus: parseVerificationStatus(row.verification_status),
        listingsCount: listingCounts.get(row.user_id) ?? 0,
        joinedAt: profile?.joined_at ?? null,
        requestedAt: row.created_at
      };
    }),
    totalItems,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    errorCode: null
  };
}

export async function getAdminCompanyDetails(userId: string): Promise<AdminCompanyDetails | null> {
  const supabase = await createClient();
  const adminClient = requireServiceRoleClient();
  const { data: company, error } = await supabase
    .from("company_profiles")
    .select(
      "user_id,company_name,representative_name,business_type,verification_status,commercial_registration,tax_number,website,company_description,created_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !company) {
    return null;
  }

  const [profileResult, listingsResult, listingsCountResult, ratingsResult, authUserResult] = await Promise.all([
    supabase.from("profiles").select("id,display_name,username,city,joined_at,phone").eq("id", userId).maybeSingle(),
    supabase.from("listings").select("id,title,status,created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(12),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase.from("ratings").select("id,rater_id,rating,comment,created_at").eq("seller_id", userId).order("created_at", { ascending: false }).limit(12),
    adminClient.auth.admin.getUserById(userId)
  ]);

  if (authUserResult.error) {
    throw new Error(authUserResult.error.message);
  }

  const ratings = ratingsResult.data ?? [];
  const raterIds = Array.from(new Set(ratings.map((item) => item.rater_id).filter((value): value is string => typeof value === "string" && value.length > 0)));
  const ratersResult =
    raterIds.length > 0
      ? await supabase.from("profiles").select("id,display_name,username").in("id", raterIds)
      : { data: [], error: null };
  const raterMap = new Map((ratersResult.data ?? []).map((item) => [item.id, item]));

  const profile = profileResult.data;
  const authUser = authUserResult.data.user;
  const bannedUntil = authUser?.banned_until ?? null;
  const bannedUntilTimestamp = bannedUntil ? Date.parse(bannedUntil) : Number.NaN;

  return {
    row: {
      userId,
      userDisplayName: toDisplayName(profile, userId),
      username: profile?.username ?? null,
      companyName: company.company_name ?? userId,
      representativeName: company.representative_name ?? "—",
      businessType: company.business_type,
      city: profile?.city ?? null,
      verificationStatus: parseVerificationStatus(company.verification_status),
      listingsCount: listingsCountResult.count ?? 0,
      joinedAt: profile?.joined_at ?? null,
      requestedAt: company.created_at
    },
    companyDescription: company.company_description,
    commercialRegistrationMasked: maskValue(company.commercial_registration),
    taxNumberMasked: company.tax_number ? maskValue(company.tax_number) : null,
    website: company.website,
    access: {
      email: authUser?.email ?? null,
      phone: profile?.phone ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      isSuspended: Number.isFinite(bannedUntilTimestamp) && bannedUntilTimestamp > Date.now()
    },
    listings: (listingsResult.data ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? item.id,
      status: item.status ?? "unknown",
      createdAt: item.created_at
    })),
    ratings: ratings.map((item) => ({
      id: item.id,
      rating: item.rating,
      comment: item.comment,
      createdAt: item.created_at,
      raterDisplayName: toDisplayName(raterMap.get(item.rater_id) ?? null, item.rater_id)
    }))
  };
}
