import test from "node:test";
import assert from "node:assert/strict";
import {
  areListingImagesUploadReady,
  buildListingImageStoragePath,
  createListingImageUploadItem,
  extractListingImageStoragePath,
  hasPendingListingImageUploads,
  markListingImageForRetry,
  toCreateListingImageInputs
} from "../src/listing-image-upload.ts";

test("builds listing image storage path from owner and mime type", () => {
  assert.equal(
    buildListingImageStoragePath({
      ownerId: "user-1",
      localId: "img-1",
      mimeType: "image/png"
    }),
    "user-1/img-1.png"
  );
});

test("maps uploaded image items to listing image inputs", () => {
  const items = [
    createListingImageUploadItem({
      localId: "img-1",
      previewUri: "data:image/jpeg;base64,abc",
      status: "uploaded",
      storagePath: "user-1/img-1.jpg",
      publicUrl: "https://example.com/storage/v1/object/public/car-listings/user-1/img-1.jpg",
      mimeType: "image/jpeg",
      isPrimary: true
    }),
    createListingImageUploadItem({
      localId: "img-2",
      previewUri: "data:image/jpeg;base64,def",
      status: "failed"
    })
  ];

  assert.deepEqual(toCreateListingImageInputs(items), [
    {
      storagePath: "user-1/img-1.jpg",
      sortOrder: 0,
      isPrimary: true,
      width: undefined,
      height: undefined,
      fileSize: undefined,
      mimeType: "image/jpeg"
    }
  ]);
  assert.equal(areListingImagesUploadReady(items), false);
  assert.equal(hasPendingListingImageUploads(items), false);
});

test("extracts storage path and resets failed items for retry", () => {
  assert.equal(
    extractListingImageStoragePath("https://project.supabase.co/storage/v1/object/public/car-listings/user-2/test%20image.jpg"),
    "user-2/test image.jpg"
  );

  const failedItem = createListingImageUploadItem({
    localId: "img-1",
    previewUri: "data:image/jpeg;base64,abc",
    status: "failed"
  });
  const retriedItem = markListingImageForRetry([failedItem], "img-1")[0];

  assert.equal(retriedItem.status, "pending");
  assert.equal(retriedItem.progress, 0);
  assert.equal(retriedItem.error, undefined);
});
