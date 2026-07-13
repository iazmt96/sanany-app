import test from "node:test";
import assert from "node:assert/strict";
import { canSendConversationMessage, countUnreadNotifications, sortNotificationsByNewest } from "../src/messaging-rules.ts";

test("counts unread notifications", () => {
  const count = countUnreadNotifications([
    { id: "1", kind: "message", referenceId: "r1", title: null, body: null, createdAt: "2026-01-01T10:00:00.000Z", isRead: false },
    { id: "2", kind: "follow", referenceId: "r2", title: null, body: null, createdAt: "2026-01-01T10:01:00.000Z", isRead: true },
    { id: "3", kind: "rating", referenceId: "r3", title: null, body: null, createdAt: "2026-01-01T10:02:00.000Z", isRead: false }
  ]);
  assert.equal(count, 2);
});

test("sorts notifications by newest first", () => {
  const sorted = sortNotificationsByNewest([
    { id: "1", kind: "message", referenceId: "r1", title: null, body: null, createdAt: "2026-01-01T10:00:00.000Z", isRead: false },
    { id: "2", kind: "follow", referenceId: "r2", title: null, body: null, createdAt: "2026-01-01T10:03:00.000Z", isRead: false },
    { id: "3", kind: "rating", referenceId: "r3", title: null, body: null, createdAt: "2026-01-01T10:01:00.000Z", isRead: false }
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["2", "3", "1"]
  );
});

test("requires message body or image url before sending", () => {
  assert.equal(canSendConversationMessage({ body: "   ", imageUrl: "   " }), false);
  assert.equal(canSendConversationMessage({ body: "Hello" }), true);
  assert.equal(canSendConversationMessage({ imageUrl: "https://example.com/image.jpg" }), true);
});
