import test from "node:test";
import assert from "node:assert/strict";
import {
  createDraftSyncOperation,
  enqueueDraftSyncOperation,
  hasPendingDraftSyncOperations,
  shouldCreateDraftConflict
} from "../src/listing-draft-queue.ts";

test("queues draft sync operations and caps retained history", () => {
  const first = createDraftSyncOperation("saveDraft", "2026-07-13T10:00:00.000Z");
  const second = createDraftSyncOperation("saveDraft", "2026-07-13T10:01:00.000Z");
  const queued = enqueueDraftSyncOperation([first], second, 2);

  assert.equal(queued.length, 2);
  assert.equal(hasPendingDraftSyncOperations(queued), true);
});

test("detects remote draft conflicts only when remote is newer than last synced state", () => {
  assert.equal(
    shouldCreateDraftConflict({
      remoteUpdatedAt: "2026-07-13T10:05:00.000Z",
      lastSyncedRemoteAt: "2026-07-13T10:01:00.000Z",
      pendingOperationsCount: 1
    }),
    true
  );

  assert.equal(
    shouldCreateDraftConflict({
      remoteUpdatedAt: "2026-07-13T10:00:00.000Z",
      lastSyncedRemoteAt: "2026-07-13T10:01:00.000Z",
      pendingOperationsCount: 1
    }),
    false
  );
});
