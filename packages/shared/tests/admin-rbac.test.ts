import test from "node:test";
import assert from "node:assert/strict";
import { hasAdminPermission, parseAdminRole } from "../src/admin-rbac.ts";

test("accepts known admin role values only", () => {
  assert.equal(parseAdminRole("super_admin"), "super_admin");
  assert.equal(parseAdminRole("random_role"), null);
  assert.equal(parseAdminRole(undefined), null);
});

test("grants super admin full privileges", () => {
  assert.equal(hasAdminPermission("super_admin", "settings.manage"), true);
  assert.equal(hasAdminPermission("super_admin", "listings.delete"), true);
});

test("limits support role to non-destructive permissions", () => {
  assert.equal(hasAdminPermission("support", "users.view"), true);
  assert.equal(hasAdminPermission("support", "listings.delete"), false);
  assert.equal(hasAdminPermission("support", "settings.manage"), false);
});
