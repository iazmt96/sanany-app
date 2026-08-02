import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/server";
import { recordAdminAuditEvent } from "./audit-events";

const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type AdminVerificationRow = {
  userId: string;
  userDisplayName: string;
  companyName: string;
  representativeName: string;
  businessType: string | null;
  verificationStatus: VerificationStatus;
  city: string | null;
  listingsCount: number;
  joinedAt: string | null;
  requestedAt: string;
};

export type AdminVerificationsPageData = {
  rows: AdminVerificationRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  errorCode: string | null;
};

export type AdminVerificationDetails = {
  row: AdminVerificationRow;
  commercialRegistrationMasked: string;
  taxNumberMasked: string | null;
  website: string | null;
  companyDescription: string | null;
};

export type AdminVerificationsFilters = {
  q?: string | null;
  status?: string | null;
  page?: string | null;
};

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseVerificationStatus(value: string | null | undefined): VerificationStatus | null {
  return VERIFICATION_STATUSES.find((status) => status === value) ?? null;
}

function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return "***";
  }
  return `${"*".repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function getAdminVerificationsPageData(filters: AdminVerificationsFilters): Promise<AdminVerificationsPageData> {
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
  const statusFilter = parseVerificationStatus(filters.status);
  if (statusFilter) {
    query = query.eq("verification_status", statusFilter);
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
  const userIds = rows.map((row) => row.user_id);
  const [profilesResult, listingsResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id,display_name,username,city,joined_at").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase.from("listings").select("id,owner_id").in("owner_id", userIds)
      : Promise.resolve({ data: [], error: null })
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
      const displayName = profile?.display_name?.trim() || profile?.username || row.user_id;
      return {
        userId: row.user_id,
        userDisplayName: displayName,
        companyName: row.company_name ?? row.user_id,
        representativeName: row.representative_name ?? "—",
        businessType: row.business_type,
        verificationStatus: parseVerificationStatus(row.verification_status) ?? "unverified",
        city: profile?.city ?? null,
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

export async function getAdminVerificationDetails(userId: string): Promise<AdminVerificationDetails | null> {
  const supabase = await createClient();
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

  const [profileResult, listingsResult] = await Promise.all([
    supabase.from("profiles").select("id,display_name,username,city,joined_at").eq("id", userId).maybeSingle(),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", userId)
  ]);

  const profile = profileResult.data;
  const row: AdminVerificationRow = {
    userId,
    userDisplayName: profile?.display_name?.trim() || profile?.username || userId,
    companyName: company.company_name ?? userId,
    representativeName: company.representative_name ?? "—",
    businessType: company.business_type,
    verificationStatus: parseVerificationStatus(company.verification_status) ?? "unverified",
    city: profile?.city ?? null,
    listingsCount: listingsResult.count ?? 0,
    joinedAt: profile?.joined_at ?? null,
    requestedAt: company.created_at
  };

  return {
    row,
    commercialRegistrationMasked: maskValue(company.commercial_registration),
    taxNumberMasked: company.tax_number ? maskValue(company.tax_number) : null,
    website: company.website,
    companyDescription: company.company_description
  };
}

export async function updateCompanyVerificationStatus(input: {
  userId: string;
  nextStatus: VerificationStatus;
  actorUserId: string;
}): Promise<{ userId: string; status: VerificationStatus }> {
  const adminClient = requireServiceRoleClient();
  const { data, error } = await adminClient
    .from("company_profiles")
    .update({ verification_status: input.nextStatus })
    .eq("user_id", input.userId)
    .select("user_id,verification_status")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Company profile was not found.");
  }

  const nextStatus = parseVerificationStatus(data.verification_status) ?? "unverified";
  await recordAdminAuditEvent({
    actorUserId: input.actorUserId,
    eventType: "verification_status_updated",
    targetUserId: data.user_id,
    metadata: {
      nextStatus
    }
  });

  return {
    userId: data.user_id,
    status: nextStatus
  };
}
