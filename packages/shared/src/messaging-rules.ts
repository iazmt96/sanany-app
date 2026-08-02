import type { NotificationItem } from "@sanany/types";

export function countUnreadNotifications(items: NotificationItem[]): number {
  return items.filter((item) => !item.isRead).length;
}

export function sortNotificationsByNewest(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function canSendConversationMessage(input: { body?: string; imageUrl?: string }): boolean {
  const body = input.body?.trim() ?? "";
  const imageUrl = input.imageUrl?.trim() ?? "";
  return body.length > 0 || imageUrl.length > 0;
}
