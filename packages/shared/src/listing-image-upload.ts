import type { CreateListingImageInput, ImageStatus } from "@sanany/types";

export const LISTING_IMAGES_BUCKET = "car-listings";

export const CAR_LISTING_IMAGE_CONFIG = {
  minImages: 1,
  recommendedImages: 5,
  maxImages: 15,
  maxFileSizeMb: 10,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  maxDimensionPx: 1800,
  compressedQuality: 0.8
} as const;

export type ListingImageUploadStatus = ImageStatus;

export type ListingImageUploadItem = {
  localId: string;
  listingImageId?: string;
  localUri?: string;
  previewUri: string;
  storagePath?: string;
  publicUrl?: string;
  status: ListingImageUploadStatus;
  progress: number;
  sortOrder: number;
  isPrimary: boolean;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  error?: string;
};

export function createListingImageUploadItem(input: {
  localId: string;
  previewUri: string;
  localUri?: string;
  storagePath?: string;
  publicUrl?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  status?: ListingImageUploadStatus;
  sortOrder?: number;
  isPrimary?: boolean;
}): ListingImageUploadItem {
  return {
    localId: input.localId,
    localUri: input.localUri,
    previewUri: input.previewUri,
    storagePath: input.storagePath,
    publicUrl: input.publicUrl,
    status: input.status ?? "pending",
    progress: input.status === "uploaded" ? 100 : 0,
    sortOrder: input.sortOrder ?? 0,
    isPrimary: input.isPrimary ?? false,
    width: input.width,
    height: input.height,
    fileSize: input.fileSize,
    mimeType: input.mimeType
  };
}

export function normalizeListingImageOrder(items: ListingImageUploadItem[]): ListingImageUploadItem[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
    isPrimary: index === 0
  }));
}

export function updateListingImageItem(
  items: ListingImageUploadItem[],
  localId: string,
  patch: Partial<ListingImageUploadItem>
): ListingImageUploadItem[] {
  return items.map((item) => (item.localId === localId ? { ...item, ...patch } : item));
}

export function markListingImageForRetry(items: ListingImageUploadItem[], localId: string): ListingImageUploadItem[] {
  return updateListingImageItem(items, localId, {
    status: "pending",
    progress: 0,
    error: undefined
  });
}

export function hasPendingListingImageUploads(items: ListingImageUploadItem[]): boolean {
  return items.some((item) => item.status === "pending" || item.status === "compressing" || item.status === "uploading");
}

export function getFailedListingImageUploads(items: ListingImageUploadItem[]): ListingImageUploadItem[] {
  return items.filter((item) => item.status === "failed");
}

export function areListingImagesUploadReady(items: ListingImageUploadItem[]): boolean {
  return items.every((item) => item.status === "uploaded" && typeof item.storagePath === "string" && typeof item.publicUrl === "string");
}

export function dedupeListingImagesByFingerprint(items: Array<{ uri: string; size?: number | null }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.uri}|${item.size ?? "na"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function isAllowedListingImageMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  return CAR_LISTING_IMAGE_CONFIG.allowedMimeTypes.includes(mimeType as (typeof CAR_LISTING_IMAGE_CONFIG.allowedMimeTypes)[number]);
}

export function getListingImageSizeLimitBytes() {
  return CAR_LISTING_IMAGE_CONFIG.maxFileSizeMb * 1024 * 1024;
}

export function resolveListingImageExtension(input: { mimeType?: string; uri?: string }): string {
  const normalizedMime = input.mimeType?.trim().toLowerCase();
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") {
    return "jpg";
  }
  if (normalizedMime === "image/png") {
    return "png";
  }
  if (normalizedMime === "image/webp") {
    return "webp";
  }

  const normalizedUri = input.uri?.trim().toLowerCase() ?? "";
  if (normalizedUri.endsWith(".png")) {
    return "png";
  }
  if (normalizedUri.endsWith(".webp")) {
    return "webp";
  }
  return "jpg";
}

export function buildListingImageStoragePath(input: {
  ownerId: string;
  localId: string;
  mimeType?: string;
  uri?: string;
}): string {
  const extension = resolveListingImageExtension({ mimeType: input.mimeType, uri: input.uri });
  return `${input.ownerId}/${input.localId}.${extension}`;
}

export function extractListingImageStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${LISTING_IMAGES_BUCKET}/`;
  const normalized = publicUrl.trim();
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  const path = normalized.slice(markerIndex + marker.length);
  return path.length > 0 ? decodeURIComponent(path) : null;
}

export function toCreateListingImageInputs(items: ListingImageUploadItem[]): CreateListingImageInput[] {
  return normalizeListingImageOrder(items)
    .filter((item) => item.status === "uploaded" && typeof item.storagePath === "string" && item.storagePath.length > 0)
    .map((item) => ({
      storagePath: item.storagePath as string,
      sortOrder: item.sortOrder,
      isPrimary: item.isPrimary,
      width: item.width,
      height: item.height,
      fileSize: item.fileSize,
      mimeType: item.mimeType
    }));
}
