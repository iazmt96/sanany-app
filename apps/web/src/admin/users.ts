import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROLES, parseAdminRole, type AdminRole } from "@sanany/shared";
import { createClient } from "../../utils/supabase/server";
import type { AppLanguage } from "@sanany/utils";
import { recordAdminAuditEvent } from "./audit-events";

export type AdminUserRow = {
  id: string;
  displayName: string;
  username: string | null;
  city: string | null;
  accountType: "individual" | "company";
  isVerified: boolean;
  joinedAt: string;
  lastSeenAt: string | null;
  listingsCount: number;
  phone: string | null;
  isSuspended: boolean;
};

export type AdminUsersPageData = {
  rows: AdminUserRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminUserDetails = {
  profile: AdminUserRow;
  bio: string | null;
  access: {
    email: string | null;
    adminRole: AdminRole | null;
    bannedUntil: string | null;
    isSuspended: boolean;
    lastSignInAt: string | null;
  };
  company: {
    companyName: string;
    representativeName: string;
    businessType: string;
    verificationStatus: string;
    commercialRegistrationMasked: string;
    taxNumberMasked: string | null;
    website: string | null;
  } | null;
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
  }>;
};

export type AdminUsersFilters = {
  q?: string | null;
  accountType?: string | null;
  verified?: string | null;
  suspended?: string | null;
  city?: string | null;
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

export function formatDateTime(value: string, language: AppLanguage): string {
  return new Date(value).toLocaleString(language === "ar" ? "ar-SA" : "en-US");
}

function maskRegistration(value: string): string {
  if (value.length <= 4) {
    return "***";
  }
  return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function asCompanyOrIndividual(value: string | null): "individual" | "company" {
  return value === "company" ? "company" : "individual";
}

async function getSuspensionMap(userIds: string[]): Promise<Map<string, boolean>> {
  const adminClient = requireServiceRoleClient();
  const entries = await Promise.all(
    userIds.map(async (userId) => {
      const result = await adminClient.auth.admin.getUserById(userId);
      if (result.error) {
        throw new Error(result.error.message);
      }
      const bannedUntil = result.data.user?.banned_until ?? null;
      const bannedUntilTimestamp = bannedUntil ? Date.parse(bannedUntil) : Number.NaN;
      return [userId, Number.isFinite(bannedUntilTimestamp) && bannedUntilTimestamp > Date.now()] as const;
    })
  );
  return new Map(entries);
}

export async function getAdminUsersPageData(filters: AdminUsersFilters): Promise<AdminUsersPageData> {
  const supabase = await createClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;

  let query = supabase
    .from("profiles")
    .select("id,display_name,username,city,account_type,is_verified,joined_at,last_seen_at,phone")
    .order("joined_at", { ascending: false });

  const q = filters.q?.trim();
  if (q && q.length > 0) {
    query = query.or(`display_name.ilike.%${q}%,username.ilike.%${q}%`);
  }
  if (filters.accountType === "individual" || filters.accountType === "company") {
    query = query.eq("account_type", filters.accountType);
  }
  if (filters.verified === "yes") {
    query = query.eq("is_verified", true);
  }
  if (filters.verified === "no") {
    query = query.eq("is_verified", false);
  }
  const suspendedFilter = filters.suspended === "yes" ? true : filters.suspended === "no" ? false : null;
  if (filters.city && filters.city.trim().length > 0) {
    query = query.ilike("city", `%${filters.city.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    return { rows: [], totalItems: 0, page, pageSize, totalPages: 1 };
  }

  const rows = data ?? [];
  const suspensionMap = await getSuspensionMap(rows.map((row) => row.id));
  const filteredRows =
    suspendedFilter === null ? rows : rows.filter((row) => (suspensionMap.get(row.id) ?? false) === suspendedFilter);
  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pagedRows = filteredRows.slice(from, from + pageSize);
  const userIds = pagedRows.map((row) => row.id);
  let listingCounts = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: listings } = await supabase.from("listings").select("id,owner_id").in("owner_id", userIds);
    listingCounts = new Map<string, number>();
    for (const listing of listings ?? []) {
      const key = listing.owner_id ?? "";
      listingCounts.set(key, (listingCounts.get(key) ?? 0) + 1);
    }
  }

  return {
    rows: pagedRows.map((row) => ({
      id: row.id,
      displayName: row.display_name ?? row.username ?? row.id,
      username: row.username,
      city: row.city,
      accountType: asCompanyOrIndividual(row.account_type),
      isVerified: Boolean(row.is_verified),
      joinedAt: row.joined_at,
      lastSeenAt: row.last_seen_at,
      listingsCount: listingCounts.get(row.id) ?? 0,
      phone: row.phone,
      isSuspended: suspensionMap.get(row.id) ?? false
    })),
    totalItems,
    page: safePage,
    pageSize,
    totalPages
  };
}

export async function getAdminUserDetails(userId: string): Promise<AdminUserDetails | null> {
  const supabase = await createClient();
  const adminClient = requireServiceRoleClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,display_name,username,city,account_type,is_verified,joined_at,last_seen_at,phone,bio")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile) {
    return null;
  }

  const [listingsResult, ratingsResult, companyResult, authUserResult] = await Promise.all([
    supabase.from("listings").select("id,title,status,created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("ratings").select("id,rating,comment,created_at").eq("seller_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase
      .from("company_profiles")
      .select("company_name,representative_name,business_type,verification_status,commercial_registration,tax_number,website")
      .eq("user_id", userId)
      .maybeSingle(),
    adminClient.auth.admin.getUserById(userId)
  ]);

  if (authUserResult.error) {
    throw new Error(authUserResult.error.message);
  }

  const authUser = authUserResult.data.user;
  const bannedUntil = authUser?.banned_until ?? null;
  const bannedUntilTimestamp = bannedUntil ? Date.parse(bannedUntil) : Number.NaN;

  return {
    profile: {
      id: profile.id,
      displayName: profile.display_name ?? profile.username ?? profile.id,
      username: profile.username,
      city: profile.city,
      accountType: asCompanyOrIndividual(profile.account_type),
      isVerified: Boolean(profile.is_verified),
      joinedAt: profile.joined_at,
      lastSeenAt: profile.last_seen_at,
      listingsCount: (listingsResult.data ?? []).length,
      phone: profile.phone,
      isSuspended: Number.isFinite(bannedUntilTimestamp) && bannedUntilTimestamp > Date.now()
    },
    bio: profile.bio,
    access: {
      email: authUser?.email ?? null,
      adminRole: parseAdminRole(authUser?.app_metadata?.admin_role),
      bannedUntil,
      isSuspended: Number.isFinite(bannedUntilTimestamp) && bannedUntilTimestamp > Date.now(),
      lastSignInAt: authUser?.last_sign_in_at ?? null
    },
    company: companyResult.data
      ? {
          companyName: companyResult.data.company_name,
          representativeName: companyResult.data.representative_name,
          businessType: companyResult.data.business_type,
          verificationStatus: companyResult.data.verification_status,
          commercialRegistrationMasked: maskRegistration(companyResult.data.commercial_registration),
          taxNumberMasked: companyResult.data.tax_number ? maskRegistration(companyResult.data.tax_number) : null,
          website: companyResult.data.website
        }
      : null,
    listings: (listingsResult.data ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? item.id,
      status: item.status ?? "unknown",
      createdAt: item.created_at
    })),
    ratings: (ratingsResult.data ?? []).map((item) => ({
      id: item.id,
      rating: item.rating,
      comment: item.comment,
      createdAt: item.created_at
    }))
  };
}

export async function updateAdminUserRole(input: {
  userId: string;
  nextRole: AdminRole | null;
  actorUserId: string;
}): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const currentUserResult = await adminClient.auth.admin.getUserById(input.userId);
  if (currentUserResult.error) {
    throw new Error(currentUserResult.error.message);
  }
  const currentMetadata =
    currentUserResult.data.user?.app_metadata && typeof currentUserResult.data.user.app_metadata === "object"
      ? currentUserResult.data.user.app_metadata
      : {};
  const nextMetadata = { ...currentMetadata } as Record<string, unknown>;
  if (input.nextRole) {
    nextMetadata.admin_role = input.nextRole;
  } else {
    delete nextMetadata.admin_role;
  }
  const { error } = await adminClient.auth.admin.updateUserById(input.userId, {
    app_metadata: nextMetadata
  });
  if (error) {
    throw new Error(error.message);
  }

  await recordAdminAuditEvent({
    actorUserId: input.actorUserId,
    eventType: "user_role_updated",
    targetUserId: input.userId,
    metadata: {
      nextRole: input.nextRole
    }
  });
}

export async function updateAdminUserSuspension(input: {
  userId: string;
  suspended: boolean;
  actorUserId: string;
}): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const { error } = await adminClient.auth.admin.updateUserById(input.userId, {
    ban_duration: input.suspended ? "100y" : "none"
  });
  if (error) {
    throw new Error(error.message);
  }

  await recordAdminAuditEvent({
    actorUserId: input.actorUserId,
    eventType: "user_access_updated",
    targetUserId: input.userId,
    metadata: {
      suspended: input.suspended
    }
  });
}

export { ADMIN_ROLES };
