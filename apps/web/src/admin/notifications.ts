import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NotificationKind } from "@sanany/types";
import { recordAdminAuditEvent } from "./audit-events";

type NotificationEventKind = "follow" | "rating" | "listing_status" | "admin_announcement";
type NotificationAudience = "all" | "individual" | "company" | "user";

type ProfileLookupRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

type ListingLookupRow = {
  id: string;
  title: string | null;
};

type RawEvent = {
  kind: NotificationEventKind;
  referenceId: string;
  recipientId: string;
  actorId: string;
  targetLabel: string;
  createdAt: string;
  href: string;
  announcementTitle?: string | null;
  announcementBody?: string | null;
  audience?: NotificationAudience | null;
};

type AdminAnnouncementRow = {
  notification_id: string;
  user_id: string;
  read_at: string | null;
  created_at: string;
  notification: Array<{
    id: string;
    title: string;
    body: string;
    audience: NotificationAudience;
    created_by: string | null;
  }> | null;
};

export type AdminNotificationSummaryCard = {
  key: NotificationEventKind;
  total: number;
  read: number;
  unread: number;
};

export type AdminNotificationEventRow = {
  id: string;
  kind: NotificationEventKind;
  recipientId: string;
  recipientName: string;
  actorName: string;
  targetLabel: string;
  createdAt: string;
  isRead: boolean;
  href: string;
};

export type AdminNotificationsPageData = {
  summary: AdminNotificationSummaryCard[];
  rows: AdminNotificationEventRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  errorCode: string | null;
};

export type AdminNotificationsFilters = {
  q?: string | null;
  kind?: string | null;
  unread?: string | null;
  page?: string | null;
};

export type SendAdminNotificationInput = {
  actorUserId: string;
  audience: NotificationAudience;
  title: string;
  body: string;
  targetUserId?: string | null;
};

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseKind(value: string | null | undefined): NotificationEventKind | null {
  if (value === "follow" || value === "rating" || value === "listing_status" || value === "admin_announcement") {
    return value;
  }
  return null;
}

function normalizeSearch(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

async function getProfileMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ProfileLookupRow>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase.from("profiles").select("id,display_name,username").in("id", userIds);
  if (error) {
    throw error;
  }
  return new Map((data ?? []).map((item) => [item.id, item]));
}

async function getListingMap(
  supabase: SupabaseClient,
  listingIds: string[]
): Promise<Map<string, ListingLookupRow>> {
  if (listingIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase.from("listings").select("id,title").in("id", listingIds);
  if (error) {
    throw error;
  }
  return new Map((data ?? []).map((item) => [item.id, item]));
}

function profileName(profile: ProfileLookupRow | undefined, fallback: string): string {
  return profile?.display_name?.trim() || profile?.username || fallback;
}

export async function getAdminNotificationsPageData(filters: AdminNotificationsFilters): Promise<AdminNotificationsPageData> {
  const adminClient = requireServiceRoleClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;
  const q = normalizeSearch(filters.q);
  const kindFilter = parseKind(filters.kind);
  const unreadOnly = filters.unread === "yes";

  const [followsResult, ratingsResult, listingStatusResult, announcementsResult] = await Promise.all([
    adminClient.from("follows").select("follower_id,following_id,created_at").order("created_at", { ascending: false }).limit(300),
    adminClient.from("ratings").select("id,rater_id,seller_id,listing_id,created_at").order("created_at", { ascending: false }).limit(300),
    adminClient.from("listing_status_events").select("id,listing_id,owner_id,created_at").order("created_at", { ascending: false }).limit(300),
    adminClient
      .from("admin_notification_deliveries")
      .select("notification_id,user_id,read_at,created_at,notification:admin_notifications(id,title,body,audience,created_by)")
      .order("created_at", { ascending: false })
      .limit(300)
  ]);

  const hasError = followsResult.error || ratingsResult.error || listingStatusResult.error || announcementsResult.error;
  if (hasError) {
    const errorCode =
      followsResult.error?.code ?? ratingsResult.error?.code ?? listingStatusResult.error?.code ?? announcementsResult.error?.code ?? "unknown";
    return {
      summary: [
        { key: "follow", total: 0, read: 0, unread: 0 },
        { key: "rating", total: 0, read: 0, unread: 0 },
        { key: "listing_status", total: 0, read: 0, unread: 0 },
        { key: "admin_announcement", total: 0, read: 0, unread: 0 }
      ],
      rows: [],
      totalItems: 0,
      page,
      pageSize,
      totalPages: 1,
      errorCode
    };
  }

  const follows = followsResult.data ?? [];
  const ratings = ratingsResult.data ?? [];
  const statusEvents = listingStatusResult.data ?? [];
  const announcements = (announcementsResult.data ?? []) as AdminAnnouncementRow[];

  const listingIds = Array.from(
    new Set(
      [...ratings.map((item) => item.listing_id), ...statusEvents.map((item) => item.listing_id)].filter(
        (value): value is string => typeof value === "string" && value.length > 0
      )
    )
  );
  const userIds = Array.from(
    new Set(
      [
        ...follows.flatMap((item) => [item.follower_id, item.following_id]),
        ...ratings.flatMap((item) => [item.rater_id, item.seller_id]),
        ...statusEvents.map((item) => item.owner_id),
        ...announcements.flatMap((item) => [item.user_id, item.notification?.[0]?.created_by ?? null])
      ].filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  try {
    const [profileMap, listingMap] = await Promise.all([getProfileMap(adminClient, userIds), getListingMap(adminClient, listingIds)]);

    const rawEvents: RawEvent[] = [];

    for (const item of follows) {
      rawEvents.push({
        kind: "follow",
        referenceId: `${item.follower_id}-${item.created_at}`,
        recipientId: item.following_id,
        actorId: item.follower_id,
        targetLabel: profileName(profileMap.get(item.following_id), item.following_id),
        createdAt: item.created_at,
        href: `/admin/users/${item.following_id}`
      });
    }

    for (const item of ratings) {
      rawEvents.push({
        kind: "rating",
        referenceId: item.id,
        recipientId: item.seller_id,
        actorId: item.rater_id,
        targetLabel: item.listing_id ? listingMap.get(item.listing_id)?.title ?? item.listing_id : item.seller_id,
        createdAt: item.created_at,
        href: item.listing_id ? `/admin/listings/${item.listing_id}` : `/admin/users/${item.seller_id}`
      });
    }

    for (const item of statusEvents) {
      rawEvents.push({
        kind: "listing_status",
        referenceId: item.id,
        recipientId: item.owner_id,
        actorId: item.owner_id,
        targetLabel: listingMap.get(item.listing_id)?.title ?? item.listing_id,
        createdAt: item.created_at,
        href: `/admin/listings/${item.listing_id}`
      });
    }

    for (const item of announcements) {
      const notification = item.notification?.[0];
      if (!notification) {
        continue;
      }
      rawEvents.push({
        kind: "admin_announcement",
        referenceId: item.notification_id,
        recipientId: item.user_id,
        actorId: notification.created_by ?? "sanany-admin",
        targetLabel: notification.title,
        createdAt: item.created_at,
        href: `/admin/users/${item.user_id}`,
        announcementTitle: notification.title,
        announcementBody: notification.body,
        audience: notification.audience
      });
    }

    const readClauses = rawEvents
      .filter((event) => event.kind !== "admin_announcement")
      .map((event) => `and(kind.eq.${event.kind},reference_id.eq.${event.referenceId},user_id.eq.${event.recipientId})`);
    const readsResult =
      readClauses.length > 0
        ? await adminClient.from("notification_reads").select("user_id,kind,reference_id").or(readClauses.join(","))
        : { data: [], error: null };

    if (readsResult.error) {
      return {
        summary: [
          { key: "follow", total: 0, read: 0, unread: 0 },
          { key: "rating", total: 0, read: 0, unread: 0 },
          { key: "listing_status", total: 0, read: 0, unread: 0 },
          { key: "admin_announcement", total: 0, read: 0, unread: 0 }
        ],
        rows: [],
        totalItems: 0,
        page,
        pageSize,
        totalPages: 1,
        errorCode: readsResult.error.code ?? "unknown"
      };
    }

    const readSet = new Set((readsResult.data ?? []).map((item) => `${item.user_id}:${item.kind}:${item.reference_id}`));
    const announcementReadSet = new Set(announcements.filter((item) => Boolean(item.read_at)).map((item) => `${item.user_id}:${item.notification_id}`));

    const rows: AdminNotificationEventRow[] = rawEvents.map((event) => {
      const recipientProfile = profileMap.get(event.recipientId);
      const actorProfile = profileMap.get(event.actorId);
      const isRead =
        event.kind === "admin_announcement"
          ? announcementReadSet.has(`${event.recipientId}:${event.referenceId}`)
          : readSet.has(`${event.recipientId}:${event.kind}:${event.referenceId}`);

      return {
        id: `${event.kind}-${event.referenceId}-${event.recipientId}`,
        kind: event.kind,
        recipientId: event.recipientId,
        recipientName: profileName(recipientProfile, event.recipientId),
        actorName:
          event.kind === "admin_announcement"
            ? profileName(actorProfile, "SANANY Admin")
            : profileName(actorProfile, event.actorId),
        targetLabel:
          event.kind === "admin_announcement"
            ? `${event.announcementTitle ?? event.targetLabel}${event.audience ? ` · ${event.audience}` : ""}`
            : event.targetLabel,
        createdAt: event.createdAt,
        isRead,
        href: event.href
      };
    });

    const summaryMap = new Map<NotificationEventKind, { total: number; read: number }>([
      ["follow", { total: 0, read: 0 }],
      ["rating", { total: 0, read: 0 }],
      ["listing_status", { total: 0, read: 0 }],
      ["admin_announcement", { total: 0, read: 0 }]
    ]);
    for (const row of rows) {
      const bucket = summaryMap.get(row.kind);
      if (!bucket) {
        continue;
      }
      bucket.total += 1;
      if (row.isRead) {
        bucket.read += 1;
      }
    }

    let filteredRows = rows;
    if (kindFilter) {
      filteredRows = filteredRows.filter((row) => row.kind === kindFilter);
    }
    if (unreadOnly) {
      filteredRows = filteredRows.filter((row) => !row.isRead);
    }
    if (q.length > 0) {
      filteredRows = filteredRows.filter((row) =>
        [row.recipientName, row.actorName, row.targetLabel].some((value) => value.toLowerCase().includes(q))
      );
    }

    filteredRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const totalItems = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * pageSize;
    const pagedRows = filteredRows.slice(from, from + pageSize);

    const summary: AdminNotificationSummaryCard[] = (
      ["follow", "rating", "listing_status", "admin_announcement"] as const
    ).map((key) => {
      const bucket = summaryMap.get(key) ?? { total: 0, read: 0 };
      return {
        key,
        total: bucket.total,
        read: bucket.read,
        unread: bucket.total - bucket.read
      };
    });

    return {
      summary,
      rows: pagedRows,
      totalItems,
      page: safePage,
      pageSize,
      totalPages,
      errorCode: null
    };
  } catch (error) {
    return {
      summary: [
        { key: "follow", total: 0, read: 0, unread: 0 },
        { key: "rating", total: 0, read: 0, unread: 0 },
        { key: "listing_status", total: 0, read: 0, unread: 0 },
        { key: "admin_announcement", total: 0, read: 0, unread: 0 }
      ],
      rows: [],
      totalItems: 0,
      page,
      pageSize,
      totalPages: 1,
      errorCode: error instanceof Error ? error.message : "unknown"
    };
  }
}

async function resolveRecipientIds(adminClient: SupabaseClient, audience: NotificationAudience, targetUserId: string | null | undefined): Promise<string[]> {
  if (audience === "user") {
    if (!targetUserId) {
      throw new Error("Target user ID is required.");
    }
    const { data, error } = await adminClient.auth.admin.getUserById(targetUserId);
    if (error) {
      throw new Error(error.message);
    }
    if (!data.user) {
      throw new Error("Target user was not found.");
    }
    return [data.user.id];
  }

  let query = adminClient.from("profiles").select("id");
  if (audience === "individual" || audience === "company") {
    query = query.eq("account_type", audience);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return Array.from(new Set((data ?? []).map((item) => item.id)));
}

export async function sendAdminNotification(input: SendAdminNotificationInput): Promise<{ notificationId: string; recipientsCount: number }> {
  const adminClient = requireServiceRoleClient();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error("Notification title and body are required.");
  }

  const recipientIds = await resolveRecipientIds(adminClient, input.audience, input.targetUserId);
  if (recipientIds.length === 0) {
    throw new Error("No recipients matched the selected audience.");
  }

  const createdResult = await adminClient
    .from("admin_notifications")
    .insert({
      created_by: input.actorUserId,
      audience: input.audience,
      audience_user_id: input.audience === "user" ? input.targetUserId ?? null : null,
      title,
      body
    })
    .select("id")
    .single();

  if (createdResult.error) {
    throw new Error(createdResult.error.message);
  }

  const notificationId = createdResult.data.id;
  const deliveries = recipientIds.map((userId) => ({
    notification_id: notificationId,
    user_id: userId
  }));
  const deliveryResult = await adminClient.from("admin_notification_deliveries").insert(deliveries);
  if (deliveryResult.error) {
    await adminClient.from("admin_notifications").delete().eq("id", notificationId);
    throw new Error(deliveryResult.error.message);
  }

  await recordAdminAuditEvent({
    actorUserId: input.actorUserId,
    eventType: "admin_announcement_sent",
    targetUserId: input.audience === "user" ? input.targetUserId ?? null : null,
    metadata: {
      audience: input.audience,
      title,
      recipientsCount: recipientIds.length
    }
  });

  return { notificationId, recipientsCount: recipientIds.length };
}

export function isNotificationAudience(value: FormDataEntryValue | null): value is NotificationAudience {
  return value === "all" || value === "individual" || value === "company" || value === "user";
}

export function isAdminNotificationKind(value: NotificationKind): value is NotificationEventKind {
  return value === "follow" || value === "rating" || value === "listing_status" || value === "admin_announcement";
}
