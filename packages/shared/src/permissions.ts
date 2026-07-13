export function isListingOwner(viewerId: string | null | undefined, ownerId: string | null | undefined): boolean {
  return Boolean(viewerId) && Boolean(ownerId) && viewerId === ownerId;
}

export function canDeleteListing(viewerId: string | null | undefined, ownerId: string | null | undefined): boolean {
  return isListingOwner(viewerId, ownerId);
}

export function canContactListingOwner(input: {
  viewerId: string | null | undefined;
  ownerId: string | null | undefined;
  ownerPhone: string | null | undefined;
}): { canChat: boolean; canCall: boolean } {
  const owner = isListingOwner(input.viewerId, input.ownerId);
  const hasPhone = Boolean(input.ownerPhone && input.ownerPhone.trim().length > 0);
  const canChat = Boolean(input.viewerId) && !owner;
  const canCall = canChat && hasPhone;
  return { canChat, canCall };
}
