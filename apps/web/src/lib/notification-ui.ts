import type { NotificationItem } from "@sanany/types";

export function getNotificationContent(
  item: NotificationItem,
  t: (key: string, options?: Record<string, unknown>) => string
): { title: string; body: string | null } {
  if (item.kind === "message") {
    return {
      title: t("notifications.templates.messageTitle"),
      body: item.body ?? t("notifications.templates.imageMessage")
    };
  }
  if (item.kind === "follow") {
    return {
      title: t("notifications.templates.followTitle", { actor: item.actorName ?? t("chat.sample.name") }),
      body: null
    };
  }
  if (item.kind === "rating") {
    return {
      title: t("notifications.templates.ratingTitle", {
        actor: item.actorName ?? t("chat.sample.name"),
        rating: item.ratingValue ?? 0
      }),
      body: item.body
    };
  }
  if (item.kind === "admin_announcement") {
    return {
      title: item.title ?? t("notifications.templates.adminAnnouncementTitle"),
      body: item.body ?? null
    };
  }
  return {
    title: t("notifications.templates.listingStatusTitle", {
      listing: item.listingTitle ?? t("marketplace.detail.pageTitle"),
      oldStatus: item.oldStatus ? t(`marketplace.status.${item.oldStatus}`) : "-",
      newStatus: item.newStatus ? t(`marketplace.status.${item.newStatus}`) : "-"
    }),
    body: null
  };
}

export function resolveNotificationHref(language: string, item: NotificationItem): string {
  if (item.kind === "message" && item.conversationId) {
    return `/${language}/chat`;
  }
  if (item.kind === "follow" && item.actorId) {
    return `/${language}/seller/${item.actorId}`;
  }
  if ((item.kind === "rating" || item.kind === "listing_status") && item.listingId) {
    return `/${language}/listing/${item.listingId}`;
  }
  return `/${language}/notifications`;
}
