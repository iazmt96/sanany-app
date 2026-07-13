import type { ListingFilterStatus } from "@sanany/types";

export const PROFILE_LISTING_VIEWS = ["active", "drafts", "sold", "expired", "favorites"] as const;
export type ProfileListingView = (typeof PROFILE_LISTING_VIEWS)[number];

export type NotificationPreferences = {
  marketing: boolean;
  messages: boolean;
  listingUpdates: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  marketing: true,
  messages: true,
  listingUpdates: true
};

export function toListingStatusFilterForProfileView(view: ProfileListingView): ListingFilterStatus | null {
  if (view === "active") {
    return "available";
  }
  if (view === "drafts") {
    return "draft";
  }
  if (view === "sold") {
    return "reserved";
  }
  if (view === "expired") {
    return "inactive";
  }
  return null;
}

export function parseNotificationPreferences(raw: string | null): NotificationPreferences {
  if (!raw) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences> | null;
    return {
      marketing: typeof parsed?.marketing === "boolean" ? parsed.marketing : DEFAULT_NOTIFICATION_PREFERENCES.marketing,
      messages: typeof parsed?.messages === "boolean" ? parsed.messages : DEFAULT_NOTIFICATION_PREFERENCES.messages,
      listingUpdates: typeof parsed?.listingUpdates === "boolean" ? parsed.listingUpdates : DEFAULT_NOTIFICATION_PREFERENCES.listingUpdates
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function serializeNotificationPreferences(preferences: NotificationPreferences): string {
  return JSON.stringify(preferences);
}
