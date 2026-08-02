import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/server";
import type { AppLanguage } from "@sanany/utils";

export type AdminStatCard = {
  key:
    | "totalUsers"
    | "usersToday"
    | "usersMonth"
    | "totalCompanies"
    | "companiesPendingVerification"
    | "totalListings"
    | "listingsAvailable"
    | "listingsReserved"
    | "paidCommissionPayments"
    | "commissionRevenue"
    | "listingsDraft"
    | "listingsInactive"
    | "openReports";
  value: number | null;
  href: string;
};

export type AdminDashboardRange = "today" | "7d" | "30d" | "3m" | "1y" | "custom";

export type AdminChartPoint = {
  label: string;
  users: number;
  listings: number;
};

export type AdminActivityItem = {
  id: string;
  type: "user_signup" | "listing_created" | "listing_status";
  title: string;
  at: string;
  href: string;
};

type CountFilter = {
  eq?: { field: string; value: string };
  gte?: { field: string; value: string };
};

type TimestampRow = {
  created_at: string;
};

type ProfileActivityRow = {
  id: string;
  display_name: string | null;
  created_at: string;
};

type ListingActivityRow = {
  id: string;
  title: string | null;
  created_at: string;
};

type ListingStatusEventRow = {
  id: string;
  listing_id: string;
  new_status: string;
  created_at: string;
};

type ListingTitleRow = {
  id: string;
  title: string | null;
};

type EventListingIdRow = {
  listing_id: string;
};

type CommissionAmountRow = {
  commission_amount: number | string | null;
};

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

async function countRows(table: string, filter?: CountFilter): Promise<number | null> {
  try {
    const supabase = await createClient();
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter?.eq) {
      query = query.eq(filter.eq.field, filter.eq.value);
    }

    if (filter?.gte) {
      query = query.gte(filter.gte.field, filter.gte.value);
    }
    const { count, error } = await query;
    if (error) {
      return null;
    }
    return count ?? 0;
  } catch {
    return null;
  }
}

function normalizeRange(value: string | null): AdminDashboardRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "3m" || value === "1y" || value === "custom") {
    return value;
  }
  return "30d";
}

function resolveRangeStart(range: AdminDashboardRange, customFrom?: string | null): string {
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (range === "7d") {
    return new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (range === "30d") {
    return new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (range === "3m") {
    return new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (range === "1y") {
    return new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (customFrom) {
    const parsed = new Date(customFrom);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
}

function formatDayLabel(isoDate: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(isoDate));
}

function aggregateByDay(values: string[], language: AppLanguage): Record<string, { label: string; count: number }> {
  const out: Record<string, { label: string; count: number }> = {};
  for (const value of values) {
    const day = value.slice(0, 10);
    if (!out[day]) {
      out[day] = { label: formatDayLabel(day, language), count: 0 };
    }
    out[day].count += 1;
  }
  return out;
}

export async function getAdminDashboardData(options: {
  language: AppLanguage;
  rangeParam?: string | null;
  customFrom?: string | null;
}): Promise<{
  cards: AdminStatCard[];
  chartPoints: AdminChartPoint[];
  recentActivities: AdminActivityItem[];
  range: AdminDashboardRange;
}> {
  const range = normalizeRange(options.rangeParam ?? null);
  const startIso = resolveRangeStart(range, options.customFrom ?? null);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const supabase = await createClient();
  const adminClient = requireServiceRoleClient();

  const [
    totalUsers,
    usersToday,
    usersMonth,
    totalCompanies,
    companiesPendingVerification,
    totalListings,
    listingsAvailable,
    listingsReserved,
    paidCommissionPayments,
    commissionRevenueResult,
    listingsDraft,
    listingsInactive,
    openReports,
    usersForChart,
    listingsForChart,
    recentUsers,
    recentListings,
    recentListingEvents,
    listingTitlesForEvents
  ] = await Promise.all([
    countRows("profiles"),
    countRows("profiles", { gte: { field: "created_at", value: dayStart } }),
    countRows("profiles", { gte: { field: "created_at", value: monthStart } }),
    countRows("company_profiles"),
    countRows("company_profiles", { eq: { field: "verification_status", value: "pending" } }),
    countRows("listings"),
    countRows("listings", { eq: { field: "status", value: "available" } }),
    countRows("listings", { eq: { field: "status", value: "reserved" } }),
    adminClient.from("listing_sale_payments").select("id", { count: "exact", head: true }).eq("payment_status", "paid"),
    adminClient.from("listing_sale_payments").select("commission_amount").eq("payment_status", "paid").limit(5000),
    countRows("listings", { eq: { field: "status", value: "draft" } }),
    countRows("listings", { eq: { field: "status", value: "inactive" } }),
    countRows("reports", { eq: { field: "status", value: "open" } }),
    supabase.from("profiles").select("created_at").gte("created_at", startIso).order("created_at", { ascending: true }).limit(5000),
    supabase.from("listings").select("created_at").gte("created_at", startIso).order("created_at", { ascending: true }).limit(5000),
    supabase.from("profiles").select("id,display_name,created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("listings").select("id,title,created_at").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("listing_status_events")
      .select("id,listing_id,new_status,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("listing_status_events").select("listing_id").order("created_at", { ascending: false }).limit(6)
  ]);

  const eventListingIdRows = (listingTitlesForEvents.data ?? []) as EventListingIdRow[];
  const eventListingIds = Array.from(
    new Set(eventListingIdRows.map((item: EventListingIdRow) => item.listing_id).filter((value: string): value is string => value.length > 0))
  );
  const eventListingsResult =
    eventListingIds.length > 0 ? await supabase.from("listings").select("id,title").in("id", eventListingIds) : { data: [], error: null };
  const eventListingMap = new Map(((eventListingsResult.data ?? []) as ListingTitleRow[]).map((item: ListingTitleRow) => [item.id, item.title ?? item.id]));

  const cards: AdminStatCard[] = [
    { key: "totalUsers", value: totalUsers, href: "/admin/users" },
    { key: "usersToday", value: usersToday, href: "/admin/users" },
    { key: "usersMonth", value: usersMonth, href: "/admin/users" },
    { key: "totalCompanies", value: totalCompanies, href: "/admin/companies" },
    { key: "companiesPendingVerification", value: companiesPendingVerification, href: "/admin/verifications" },
    { key: "totalListings", value: totalListings, href: "/admin/listings" },
    { key: "listingsAvailable", value: listingsAvailable, href: "/admin/listings" },
    { key: "listingsReserved", value: listingsReserved, href: "/admin/listings" },
    { key: "paidCommissionPayments", value: paidCommissionPayments.count ?? 0, href: "/admin/commission-payments" },
    {
      key: "commissionRevenue",
      value: commissionRevenueResult.error
        ? null
        : Math.round(
            ((commissionRevenueResult.data ?? []) as CommissionAmountRow[]).reduce(
              (sum: number, item: CommissionAmountRow) => sum + Number(item.commission_amount ?? 0),
              0
            )
          ),
      href: "/admin/commission-payments"
    },
    { key: "listingsDraft", value: listingsDraft, href: "/admin/listings" },
    { key: "listingsInactive", value: listingsInactive, href: "/admin/listings" },
    { key: "openReports", value: openReports, href: "/admin/reports" }
  ];

  const userDays = usersForChart.error
    ? {}
    : aggregateByDay(((usersForChart.data ?? []) as TimestampRow[]).map((item: TimestampRow) => item.created_at), options.language);
  const listingDays = listingsForChart.error
    ? {}
    : aggregateByDay(((listingsForChart.data ?? []) as TimestampRow[]).map((item: TimestampRow) => item.created_at), options.language);
  const dayKeys = Array.from(new Set([...Object.keys(userDays), ...Object.keys(listingDays)])).sort();
  const chartPoints: AdminChartPoint[] = dayKeys.map((day) => ({
    label: userDays[day]?.label ?? listingDays[day]?.label ?? day,
    users: userDays[day]?.count ?? 0,
    listings: listingDays[day]?.count ?? 0
  }));

  const activities: AdminActivityItem[] = [];
  for (const item of (recentUsers.data ?? []) as ProfileActivityRow[]) {
    activities.push({
      id: `user-${item.id}`,
      type: "user_signup",
      title: item.display_name?.trim() ? item.display_name : item.id,
      at: item.created_at,
      href: `/admin/users/${item.id}`
    });
  }
  for (const item of (recentListings.data ?? []) as ListingActivityRow[]) {
    activities.push({
      id: `listing-${item.id}`,
      type: "listing_created",
      title: item.title?.trim() ? item.title : item.id,
      at: item.created_at,
      href: `/admin/listings/${item.id}`
    });
  }
  for (const item of (recentListingEvents.data ?? []) as ListingStatusEventRow[]) {
    const listingTitle = eventListingMap.get(item.listing_id) ?? item.listing_id;
    activities.push({
      id: `status-${item.id}`,
      type: "listing_status",
      title: `${listingTitle} → ${item.new_status}`,
      at: item.created_at,
      href: `/admin/listings/${item.listing_id}`
    });
  }
  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    cards,
    chartPoints,
    recentActivities: activities.slice(0, 10),
    range
  };
}
