import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationMessage,
  ConversationSummary,
  MarketplaceListing,
  NotificationItem,
  NotificationKind,
  PaginatedResult,
  SendConversationMessageInput
} from "@sanany/types";

type ListingRow = {
  id: string;
  owner_id: string | null;
  owner_phone: string | null;
  title: string;
  description: string | null;
  price: number;
  status: MarketplaceListing["status"];
  image_url: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  account_type: ConversationSummary["otherUserAccountType"] | null;
  is_verified: boolean | null;
};

type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_preview: string | null;
  last_message_at: string;
  blocked_by: string | null;
  reported_by: string | null;
  listing: ListingRow | null;
  buyer: ProfileRow | null;
  seller: ProfileRow | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
};

type FollowNotificationRow = {
  follower_id: string;
  created_at: string;
  profile: ProfileRow[] | null;
};

type RatingNotificationRow = {
  id: string;
  rater_id: string;
  listing_id: string | null;
  comment: string | null;
  rating: number;
  created_at: string;
  profile: ProfileRow[] | null;
};

type ListingStatusEventRow = {
  id: string;
  listing_id: string;
  old_status: string;
  new_status: string;
  created_at: string;
  listing: Pick<ListingRow, "title">[] | null;
};

type NotificationReadRow = {
  kind: NotificationKind;
  reference_id: string;
};

type AdminAnnouncementDeliveryRow = {
  notification_id: string;
  read_at: string | null;
  created_at: string;
  notification: Array<{
    title: string;
    body: string;
    audience: string;
  }> | null;
};

function mapListingRow(row: ListingRow): MarketplaceListing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerPhone: row.owner_phone,
    title: row.title,
    description: row.description,
    price: row.price,
    status: row.status,
    imageUrl: row.image_url,
    locationName: row.location_name,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at
  };
}

function getProfileDisplayName(profile: ProfileRow | null): string {
  if (!profile) {
    return "SANANY";
  }
  return profile.display_name ?? profile.username ?? "SANANY";
}

function sortByDateDescending<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20;
  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize;
  const totalItems = items.length;
  return {
    items: items.slice(start, end),
    totalItems,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
  };
}

export type MessagingRepository = {
  listConversations(input: { userId: string; page: number; pageSize: number }): Promise<PaginatedResult<ConversationSummary>>;
  ensureConversation(input: { listingId: string; buyerId: string; sellerId: string }): Promise<ConversationSummary>;
  listMessages(input: { conversationId: string; userId: string; page: number; pageSize: number }): Promise<PaginatedResult<ConversationMessage>>;
  sendMessage(input: SendConversationMessageInput): Promise<ConversationMessage>;
  markConversationRead(input: { conversationId: string; userId: string }): Promise<void>;
  setConversationBlocked(input: { conversationId: string; userId: string; blocked: boolean }): Promise<void>;
  reportConversation(input: { conversationId: string; userId: string }): Promise<void>;
  listNotifications(input: { userId: string; page: number; pageSize: number }): Promise<PaginatedResult<NotificationItem>>;
  markNotificationsRead(input: { userId: string; items: Array<Pick<NotificationItem, "kind" | "referenceId">> }): Promise<void>;
};

async function getConversationRowById(client: SupabaseClient, conversationId: string): Promise<ConversationRow | null> {
  const { data, error } = await client
    .from("conversations")
    .select(
      "id,listing_id,buyer_id,seller_id,last_message_preview,last_message_at,blocked_by,reported_by,listing:listings(id,owner_id,owner_phone,title,description,price,status,image_url,location_name,latitude,longitude,created_at),buyer:profiles!conversations_buyer_id_fkey(id,username,display_name,avatar_url,account_type,is_verified),seller:profiles!conversations_seller_id_fkey(id,username,display_name,avatar_url,account_type,is_verified)"
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data as ConversationRow | null) ?? null;
}

async function getUnreadCountForConversation(client: SupabaseClient, conversationId: string, userId: string): Promise<number> {
  const { count, error } = await client
    .from("conversation_messages")
    .select("id", { head: true, count: "exact" })
    .eq("conversation_id", conversationId)
    .is("read_at", null)
    .neq("sender_id", userId);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function mapConversationRowToSummary(client: SupabaseClient, row: ConversationRow, userId: string): Promise<ConversationSummary> {
  const isBuyer = row.buyer_id === userId;
  const otherProfile = isBuyer ? row.seller : row.buyer;
  const otherUserId = isBuyer ? row.seller_id : row.buyer_id;
  const listing = row.listing ?? {
    id: row.listing_id,
    owner_id: row.seller_id,
    owner_phone: null,
    title: "SANANY",
    description: null,
    price: 0,
    status: "available",
    image_url: null,
    location_name: null,
    latitude: null,
    longitude: null,
    created_at: row.last_message_at
  };
  const unreadCount = await getUnreadCountForConversation(client, row.id, userId);
  return {
    id: row.id,
    listing: mapListingRow(listing),
    otherUserId,
    otherUserName: getProfileDisplayName(otherProfile),
    otherUserAvatarUrl: otherProfile?.avatar_url ?? null,
    otherUserVerified: otherProfile?.is_verified ?? false,
    otherUserAccountType: otherProfile?.account_type ?? "individual",
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    unreadCount,
    isBlocked: row.blocked_by === userId,
    isBlockedByOther: Boolean(row.blocked_by) && row.blocked_by !== userId,
    isReported: row.reported_by === userId
  };
}

export function createMessagingRepository(client: SupabaseClient): MessagingRepository {
  return {
    async listConversations({ userId, page, pageSize }) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20;
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;
      const { data, error, count } = await client
        .from("conversations")
        .select(
          "id,listing_id,buyer_id,seller_id,last_message_preview,last_message_at,blocked_by,reported_by,listing:listings(id,owner_id,owner_phone,title,description,price,status,image_url,location_name,latitude,longitude,created_at),buyer:profiles!conversations_buyer_id_fkey(id,username,display_name,avatar_url,account_type,is_verified),seller:profiles!conversations_seller_id_fkey(id,username,display_name,avatar_url,account_type,is_verified)",
          { count: "exact" }
        )
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })
        .range(from, to);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as ConversationRow[];
      const items = await Promise.all(rows.map((row) => mapConversationRowToSummary(client, row, userId)));
      const totalItems = count ?? 0;
      return {
        items,
        totalItems,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
      };
    },

    async ensureConversation({ listingId, buyerId, sellerId }) {
      const existing = await client
        .from("conversations")
        .select("id")
        .eq("listing_id", listingId)
        .eq("buyer_id", buyerId)
        .eq("seller_id", sellerId)
        .maybeSingle();
      if (existing.error) {
        throw existing.error;
      }

      let conversationId = (existing.data as { id: string } | null)?.id ?? null;
      if (!conversationId) {
        const created = await client
          .from("conversations")
          .insert({
            listing_id: listingId,
            buyer_id: buyerId,
            seller_id: sellerId
          })
          .select("id")
          .single();
        if (created.error) {
          throw created.error;
        }
        conversationId = (created.data as { id: string }).id;
      }

      const row = await getConversationRowById(client, conversationId);
      if (!row) {
        throw new Error("Conversation not found.");
      }
      return mapConversationRowToSummary(client, row, buyerId);
    },

    async listMessages({ conversationId, userId, page, pageSize }) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 50;
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;
      const { data, error, count } = await client
        .from("conversation_messages")
        .select("id,conversation_id,sender_id,body,image_url,read_at,created_at", { count: "exact" })
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .range(from, to);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as MessageRow[];
      const items: ConversationMessage[] = rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        body: row.body,
        imageUrl: row.image_url,
        readAt: row.read_at,
        createdAt: row.created_at
      }));
      const totalItems = count ?? 0;
      return {
        items,
        totalItems,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
      };
    },

    async sendMessage({ conversationId, senderId, body, imageUrl }) {
      const normalizedBody = body?.trim() ?? "";
      const normalizedImageUrl = imageUrl?.trim() ?? "";
      const { data, error } = await client
        .from("conversation_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          body: normalizedBody.length > 0 ? normalizedBody : null,
          image_url: normalizedImageUrl.length > 0 ? normalizedImageUrl : null
        })
        .select("id,conversation_id,sender_id,body,image_url,read_at,created_at")
        .single();
      if (error) {
        throw error;
      }
      const row = data as MessageRow;
      return {
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        body: row.body,
        imageUrl: row.image_url,
        readAt: row.read_at,
        createdAt: row.created_at
      };
    },

    async markConversationRead({ conversationId, userId }) {
      const { error } = await client
        .from("conversation_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .is("read_at", null)
        .neq("sender_id", userId);
      if (error) {
        throw error;
      }
    },

    async setConversationBlocked({ conversationId, userId, blocked }) {
      const { error } = await client
        .from("conversations")
        .update({ blocked_by: blocked ? userId : null })
        .eq("id", conversationId);
      if (error) {
        throw error;
      }
    },

    async reportConversation({ conversationId, userId }) {
      const { error } = await client
        .from("conversations")
        .update({ reported_by: userId })
        .eq("id", conversationId);
      if (error) {
        throw error;
      }
    },

    async listNotifications({ userId, page, pageSize }) {
      const conversationsResult = await client.from("conversations").select("id").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
      if (conversationsResult.error) {
        throw conversationsResult.error;
      }
      const conversationIds = ((conversationsResult.data ?? []) as Array<{ id: string }>).map((item) => item.id);

      const [messagesResult, followsResult, ratingsResult, listingStatusResult, adminAnnouncementsResult, readsResult] = await Promise.all([
        conversationIds.length > 0
          ? client
              .from("conversation_messages")
              .select("id,conversation_id,sender_id,body,image_url,created_at")
              .in("conversation_id", conversationIds)
              .neq("sender_id", userId)
              .order("created_at", { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [], error: null }),
        client
          .from("follows")
          .select("follower_id,created_at,profile:profiles!follows_follower_id_fkey(id,username,display_name,avatar_url,account_type,is_verified)")
          .eq("following_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
        client
          .from("ratings")
          .select("id,rater_id,listing_id,comment,rating,created_at,profile:profiles!ratings_rater_id_fkey(id,username,display_name,avatar_url,account_type,is_verified)")
          .eq("seller_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
        client
          .from("listing_status_events")
          .select("id,listing_id,old_status,new_status,created_at,listing:listings(title)")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
        client
          .from("admin_notification_deliveries")
          .select("notification_id,read_at,created_at,notification:admin_notifications(title,body,audience)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
        client.from("notification_reads").select("kind,reference_id").eq("user_id", userId)
      ]);

      if (messagesResult.error) {
        throw messagesResult.error;
      }
      if (followsResult.error) {
        throw followsResult.error;
      }
      if (ratingsResult.error) {
        throw ratingsResult.error;
      }
      if (listingStatusResult.error) {
        throw listingStatusResult.error;
      }
      if (adminAnnouncementsResult.error) {
        throw adminAnnouncementsResult.error;
      }
      if (readsResult.error) {
        throw readsResult.error;
      }

      const readKeys = new Set(
        ((readsResult.data ?? []) as NotificationReadRow[]).map((item) => `${item.kind}:${item.reference_id}`)
      );

      const messageItems: NotificationItem[] = ((messagesResult.data ?? []) as Array<Pick<MessageRow, "id" | "conversation_id" | "body" | "image_url" | "created_at">>).map((message) => {
        return {
          id: `message-${message.id}`,
          kind: "message",
          referenceId: message.id,
          title: null,
          body: message.body ?? null,
          createdAt: message.created_at,
          isRead: readKeys.has(`message:${message.id}`),
          conversationId: message.conversation_id,
          messagePreview: message.body ?? (message.image_url ? "image" : null)
        };
      });

      const followItems: NotificationItem[] = ((followsResult.data ?? []) as FollowNotificationRow[]).map((follow) => {
        const profile = follow.profile?.[0] ?? null;
        return {
          id: `follow-${follow.follower_id}-${follow.created_at}`,
          kind: "follow",
          referenceId: `${follow.follower_id}-${follow.created_at}`,
          title: null,
          body: null,
          createdAt: follow.created_at,
          isRead: readKeys.has(`follow:${follow.follower_id}-${follow.created_at}`),
          actorId: follow.follower_id,
          actorName: getProfileDisplayName(profile)
        };
      });

      const ratingItems: NotificationItem[] = ((ratingsResult.data ?? []) as RatingNotificationRow[]).map((rating) => {
        const profile = rating.profile?.[0] ?? null;
        return {
          id: `rating-${rating.id}`,
          kind: "rating",
          referenceId: rating.id,
          title: null,
          body: rating.comment,
          createdAt: rating.created_at,
          isRead: readKeys.has(`rating:${rating.id}`),
          listingId: rating.listing_id,
          actorId: rating.rater_id,
          actorName: getProfileDisplayName(profile),
          ratingValue: rating.rating
        };
      });

      const listingStatusItems: NotificationItem[] = ((listingStatusResult.data ?? []) as ListingStatusEventRow[]).map((event) => ({
        id: `listing-status-${event.id}`,
        kind: "listing_status",
        referenceId: event.id,
        title: null,
        body: null,
        createdAt: event.created_at,
        isRead: readKeys.has(`listing_status:${event.id}`),
        listingId: event.listing_id,
        listingTitle: event.listing?.[0]?.title ?? null,
        oldStatus: event.old_status,
        newStatus: event.new_status
      }));

      const adminAnnouncementItems: NotificationItem[] = ((adminAnnouncementsResult.data ?? []) as AdminAnnouncementDeliveryRow[]).map((delivery) => {
        const notification = delivery.notification?.[0];
        return {
          id: `admin-announcement-${delivery.notification_id}`,
          kind: "admin_announcement",
          referenceId: delivery.notification_id,
          title: notification?.title ?? null,
          body: notification?.body ?? null,
          createdAt: delivery.created_at,
          isRead: Boolean(delivery.read_at),
          audience: notification?.audience ?? null
        };
      });

      const merged = sortByDateDescending([...messageItems, ...followItems, ...ratingItems, ...listingStatusItems, ...adminAnnouncementItems]);
      return paginate(merged, page, pageSize);
    },

    async markNotificationsRead({ userId, items }) {
      if (items.length === 0) {
        return;
      }
      const readAt = new Date().toISOString();
      const announcementItems = items.filter((item) => item.kind === "admin_announcement");
      const standardItems = items.filter((item) => item.kind !== "admin_announcement");

      if (announcementItems.length > 0) {
        const announcementIds = announcementItems.map((item) => item.referenceId);
        const { error } = await client
          .from("admin_notification_deliveries")
          .update({ read_at: readAt })
          .eq("user_id", userId)
          .in("notification_id", announcementIds);
        if (error) {
          throw error;
        }
      }

      if (standardItems.length > 0) {
        const payload = standardItems.map((item) => ({
          user_id: userId,
          kind: item.kind,
          reference_id: item.referenceId,
          read_at: readAt
        }));
        const { error } = await client.from("notification_reads").upsert(payload, { onConflict: "user_id,kind,reference_id" });
        if (error) {
          throw error;
        }
      }
    }
  };
}
