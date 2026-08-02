import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/server";
import { recordAdminAuditEvent } from "./audit-events";

const REPORT_STATUSES = ["open", "reviewed", "closed"] as const;
type ReportStatus = (typeof REPORT_STATUSES)[number];

export type AdminReportRow = {
  id: string;
  reportType: string;
  status: string;
  reason: string | null;
  reporterId: string | null;
  reporterDisplayName: string | null;
  reportedUserId: string | null;
  reportedUserDisplayName: string | null;
  reportedListingId: string | null;
  reportedListingTitle: string | null;
  createdAt: string;
};

export type AdminReportsPageData = {
  rows: AdminReportRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  errorCode: string | null;
};

export type AdminReportDetails = {
  row: AdminReportRow;
};

export type AdminReportsFilters = {
  q?: string | null;
  status?: string | null;
  type?: string | null;
  page?: string | null;
};

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

function parseReportStatus(value: string | null | undefined): ReportStatus | null {
  return REPORT_STATUSES.find((status) => status === value) ?? null;
}

export async function getAdminReportsPageData(filters: AdminReportsFilters): Promise<AdminReportsPageData> {
  const supabase = await createClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = filters.q?.trim() ?? "";
  const statusFilter = parseReportStatus(filters.status);
  const typeFilter = filters.type?.trim() ?? "";

  let query = supabase
    .from("reports")
    .select("id,status,report_type,reason,reporter_id,reported_user_id,reported_listing_id,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (typeFilter.length > 0) {
    query = query.eq("report_type", typeFilter);
  }
  if (q.length > 0) {
    if (isUuid(q)) {
      query = query.or(`id.eq.${q},reported_user_id.eq.${q},reported_listing_id.eq.${q},reporter_id.eq.${q}`);
    } else {
      query = query.or(`report_type.ilike.%${q}%,reason.ilike.%${q}%`);
    }
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
  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.reporter_id, row.reported_user_id])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
  const listingIds = Array.from(
    new Set(rows.map((row) => row.reported_listing_id).filter((value): value is string => typeof value === "string" && value.length > 0))
  );

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
      reportType: row.report_type ?? "unknown",
      status: row.status ?? "unknown",
      reason: row.reason,
      reporterId: row.reporter_id,
      reporterDisplayName: row.reporter_id ? profileMap.get(row.reporter_id)?.display_name ?? profileMap.get(row.reporter_id)?.username ?? row.reporter_id : null,
      reportedUserId: row.reported_user_id,
      reportedUserDisplayName: row.reported_user_id
        ? profileMap.get(row.reported_user_id)?.display_name ?? profileMap.get(row.reported_user_id)?.username ?? row.reported_user_id
        : null,
      reportedListingId: row.reported_listing_id,
      reportedListingTitle: row.reported_listing_id ? listingMap.get(row.reported_listing_id)?.title ?? row.reported_listing_id : null,
      createdAt: row.created_at
    })),
    totalItems,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    errorCode: null
  };
}

export async function getAdminReportDetails(reportId: string): Promise<AdminReportDetails | null> {
  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("id,status,report_type,reason,reporter_id,reported_user_id,reported_listing_id,created_at")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !report) {
    return null;
  }

  const [profilesResult, listingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,username")
      .in("id", [report.reporter_id, report.reported_user_id].filter((value): value is string => typeof value === "string")),
    report.reported_listing_id
      ? supabase.from("listings").select("id,title").eq("id", report.reported_listing_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item]));
  const row: AdminReportRow = {
    id: report.id,
    reportType: report.report_type ?? "unknown",
    status: report.status ?? "unknown",
    reason: report.reason,
    reporterId: report.reporter_id,
    reporterDisplayName: report.reporter_id
      ? profileMap.get(report.reporter_id)?.display_name ?? profileMap.get(report.reporter_id)?.username ?? report.reporter_id
      : null,
    reportedUserId: report.reported_user_id,
    reportedUserDisplayName: report.reported_user_id
      ? profileMap.get(report.reported_user_id)?.display_name ?? profileMap.get(report.reported_user_id)?.username ?? report.reported_user_id
      : null,
    reportedListingId: report.reported_listing_id,
    reportedListingTitle: report.reported_listing_id ? listingResult.data?.title ?? report.reported_listing_id : null,
    createdAt: report.created_at
  };

  return { row };
}

export async function updateAdminReportStatus(input: {
  reportId: string;
  nextStatus: ReportStatus;
  actorUserId: string;
}): Promise<{ id: string; status: string }> {
  const adminClient = requireServiceRoleClient();
  const { data, error } = await adminClient
    .from("reports")
    .update({ status: input.nextStatus })
    .eq("id", input.reportId)
    .select("id,status")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Report was not found.");
  }

  await recordAdminAuditEvent({
    actorUserId: input.actorUserId,
    eventType: "report_status_updated",
    targetReportId: data.id,
    metadata: {
      nextStatus: data.status ?? input.nextStatus
    }
  });

  return { id: data.id, status: data.status ?? "unknown" };
}
