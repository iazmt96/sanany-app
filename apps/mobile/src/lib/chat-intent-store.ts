import type { MarketplaceListing } from "@sanany/types";

let pendingChatListingIntent: MarketplaceListing | null = null;

export function setPendingChatListingIntent(listing: MarketplaceListing) {
  pendingChatListingIntent = listing;
}

export function consumePendingChatListingIntent() {
  const intent = pendingChatListingIntent;
  pendingChatListingIntent = null;
  return intent;
}
