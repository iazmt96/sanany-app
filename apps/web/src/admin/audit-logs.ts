import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/server";
import { ADMIN_AUDIT_EVENT_TYPES, type AdminAuditEventType } from "./audit-events";

const AUDIT_LOG_TYPES = ["listing_status", "report_created", "rating_created", ...ADMIN_AUDIT_EVENT_TYPES] as const;
type AuditLogType = (typeof AUDIT_LOG_TYPES)[number];

type AdminAuditEventRow = {
  id: string;
  actor_user_id: string | null;
  event_type: AdminAuditEventType;
  target_user_id: string | null;
  target_listing_id: string | null;
  target_report_id: string | null;
  target_review_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AdminAuditLogRow = {
  id: string;
  type: AuditLogType;
  title: string;
  actorName: string;
  targetLabel: string;
  createdAt: string;
  href: string;
};

export type AdminAuditLogsPageData = {
  rows: AdminAuditLogRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  errorCode: string | null;
};

export type AdminAuditLogsFilters = {
  q?: string | null;
  type?: string | null;
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

function parseLogType(value: string | null | undefined): AuditLogType | null {
  return AUDIT_LOG_TYPES.find((item) => item === value) ?? null;
}

function normalizeSearch(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function getActorName(profileMap: Map<string, { id: string; display_name: string | null; username: string | null }>, actorUserId: string | null) {
  if (!actorUserId) {
    return "—";
  }
  const actor = profileMap.get(actorUserId);
  return actor?.display_name?.trim() || actor?.username || actorUserId;
}

function readStringMetadata(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumberMetadata(metadata: Record<string, unknown> | null, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBooleanMetadata(metadata: Record<string, unknown> | null, key: string): boolean | null {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

export async function getAdminAuditLogsPageData(filters: AdminAuditLogsFilters): Promise<AdminAuditLogsPageData> {
  const supabase = await createClient();
  const adminClient = requireServiceRoleClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;
  const search = normalizeSearch(filters.q);
  const typeFilter = parseLogType(filters.type);

  const [statusEventsResult, reportsResult, ratingsResult, adminEventsResult] = await Promise.all([
    supabase
      .from("listing_status_events")
      .select("id,listing_id,owner_id,old_status,new_status,created_at")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("reports")
      .select("id,report_type,reporter_id,reported_user_id,reported_listing_id,created_at")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("ratings")
      .select("id,seller_id,rater_id,listing_id,rating,created_at")
      .order("created_at", { ascending: false })
      .limit(150),
    adminClient
      .from("admin_audit_events")
      .select("id,actor_user_id,event_type,target_user_id,target_listing_id,target_report_id,target_review_id,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(150)
  ]);

  const hasError = statusEventsResult.error || reportsResult.error || ratingsResult.error || adminEventsResult.error;
  if (hasError) {
    const errorCode =
      statusEventsResult.error?.code ??
      reportsResult.error?.code ??
      ratingsResult.error?.code ??
      adminEventsResult.error?.code ??
      "unknown";
    return {
      rows: [],
      totalItems: 0,
      page,
      pageSize,
      totalPages: 1,
      errorCode
    };
  }

  const statusEvents = statusEventsResult.data ?? [];
  const reports = reportsResult.data ?? [];
  const ratings = ratingsResult.data ?? [];
  const adminEvents = (adminEventsResult.data ?? []) as AdminAuditEventRow[];

  const profileIds = Array.from(
    new Set(
      [
        ...statusEvents.map((item) => item.owner_id),
        ...reports.flatMap((item) => [item.reporter_id, item.reported_user_id]),
        ...ratings.flatMap((item) => [item.rater_id, item.seller_id]),
        ...adminEvents.flatMap((item) => [item.actor_user_id, item.target_user_id])
      ].filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const listingIds = Array.from(
    new Set(
      [
        ...statusEvents.map((item) => item.listing_id),
        ...reports.map((item) => item.reported_listing_id),
        ...ratings.map((item) => item.listing_id),
        ...adminEvents.map((item) => item.target_listing_id)
      ].filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const [profilesResult, listingsResult] = await Promise.all([
    profileIds.length > 0 ? supabase.from("profiles").select("id,display_name,username").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
    listingIds.length > 0 ? supabase.from("listings").select("id,title").in("id", listingIds) : Promise.resolve({ data: [], error: null })
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item]));
  const listingMap = new Map((listingsResult.data ?? []).map((item) => [item.id, item]));
  const rows: AdminAuditLogRow[] = [];

  for (const item of statusEvents) {
    rows.push({
      id: `listing-status-${item.id}`,
      type: "listing_status",
      title: `${item.old_status ?? "unknown"} -> ${item.new_status ?? "unknown"}`,
      actorName: getActorName(profileMap, item.owner_id),
      targetLabel: listingMap.get(item.listing_id)?.title ?? item.listing_id,
      createdAt: item.created_at,
      href: `/admin/listings/${item.listing_id}`
    });
  }

  for (const item of reports) {
    const listingTitle = item.reported_listing_id ? listingMap.get(item.reported_listing_id)?.title ?? item.reported_listing_id : null;
    const targetLabel =
      listingTitle ??
      (item.reported_user_id ? profileMap.get(item.reported_user_id)?.display_name ?? profileMap.get(item.reported_user_id)?.username ?? item.reported_user_id : "—");
    rows.push({
      id: `report-created-${item.id}`,
      type: "report_created",
      title: item.report_type ?? "report",
      actorName: getActorName(profileMap, item.reporter_id),
      targetLabel,
      createdAt: item.created_at,
      href: `/admin/reports/${item.id}`
    });
  }

  for (const item of ratings) {
    const sellerName = profileMap.get(item.seller_id)?.display_name ?? profileMap.get(item.seller_id)?.username ?? item.seller_id;
    rows.push({
      id: `rating-created-${item.id}`,
      type: "rating_created",
      title: `rating=${item.rating}`,
      actorName: getActorName(profileMap, item.rater_id),
      targetLabel: sellerName,
      createdAt: item.created_at,
      href: item.listing_id ? `/admin/listings/${item.listing_id}` : `/admin/users/${item.seller_id}`
    });
  }

  for (const item of adminEvents) {
    const actorName = getActorName(profileMap, item.actor_user_id);
    const targetUserName =
      item.target_user_id ? profileMap.get(item.target_user_id)?.display_name ?? profileMap.get(item.target_user_id)?.username ?? item.target_user_id : null;
    const targetListingTitle = item.target_listing_id ? listingMap.get(item.target_listing_id)?.title ?? item.target_listing_id : null;
    const audience = readStringMetadata(item.metadata, "audience");
    const nextStatus = readStringMetadata(item.metadata, "nextStatus");
    const nextRole = readStringMetadata(item.metadata, "nextRole");
    const suspended = readBooleanMetadata(item.metadata, "suspended");
    const rating = readNumberMetadata(item.metadata, "rating");
    const announcementTitle = readStringMetadata(item.metadata, "title");
    const recipientsCount = readNumberMetadata(item.metadata, "recipientsCount");

    let title: string = item.event_type;
    let targetLabel: string = targetUserName ?? targetListingTitle ?? item.target_report_id ?? item.target_review_id ?? "—";
    let href: string = "/admin/audit-logs";

    if (item.event_type === "admin_announcement_sent") {
      title = audience ? `audience=${audience}` : "admin announcement";
      targetLabel = announcementTitle ?? targetUserName ?? "—";
      if (typeof recipientsCount === "number") {
        title = `${title} • recipients=${recipientsCount}`;
      }
      href = "/admin/notifications";
    } else if (item.event_type === "report_status_updated") {
      title = nextStatus ? `status -> ${nextStatus}` : "report status updated";
      targetLabel = item.target_report_id ?? "—";
      href = item.target_report_id ? `/admin/reports/${item.target_report_id}` : "/admin/reports";
    } else if (item.event_type === "verification_status_updated") {
      title = nextStatus ? `verification -> ${nextStatus}` : "verification updated";
      targetLabel = targetUserName ?? item.target_user_id ?? "—";
      href = item.target_user_id ? `/admin/verifications/${item.target_user_id}` : "/admin/verifications";
    } else if (item.event_type === "user_role_updated") {
      title = nextRole ? `role -> ${nextRole}` : "role cleared";
      targetLabel = targetUserName ?? item.target_user_id ?? "—";
      href = item.target_user_id ? `/admin/users/${item.target_user_id}` : "/admin/users";
    } else if (item.event_type === "user_access_updated") {
      title = suspended === null ? "access updated" : suspended ? "account suspended" : "account restored";
      targetLabel = targetUserName ?? item.target_user_id ?? "—";
      href = item.target_user_id ? `/admin/users/${item.target_user_id}` : "/admin/users";
    } else if (item.event_type === "review_deleted") {
      title = typeof rating === "number" ? `review deleted • rating=${rating}` : "review deleted";
      targetLabel = targetUserName ?? targetListingTitle ?? item.target_review_id ?? "—";
      href = targetListingTitle && item.target_listing_id ? `/admin/listings/${item.target_listing_id}` : "/admin/reviews";
    }

    rows.push({
      id: `admin-event-${item.id}`,
      type: item.event_type,
      title,
      actorName,
      targetLabel,
      createdAt: item.created_at,
      href
    });
  }

  let filtered = rows;
  if (typeFilter) {
    filtered = filtered.filter((row) => row.type === typeFilter);
  }
  if (search.length > 0) {
    filtered = filtered.filter((row) =>
      [row.title, row.actorName, row.targetLabel].some((value) => value.toLowerCase().includes(search))
    );
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pagedRows = filtered.slice(from, from + pageSize);

  return {
    rows: pagedRows,
    totalItems,
    page: safePage,
    pageSize,
    totalPages,
    errorCode: null
  };
}
