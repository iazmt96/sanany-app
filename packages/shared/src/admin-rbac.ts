export const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "moderator",
  "support",
  "content_manager",
  "finance"
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "users.view",
  "users.edit",
  "users.suspend",
  "companies.verify",
  "listings.view",
  "listings.approve",
  "listings.reject",
  "listings.delete",
  "reports.manage",
  "reviews.manage",
  "categories.manage",
  "notifications.send",
  "settings.manage",
  "finance.manage",
  "audit_logs.view",
  "dashboard.view"
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlyArray<AdminPermission>> = {
  super_admin: ADMIN_PERMISSIONS,
  admin: [
    "dashboard.view",
    "users.view",
    "users.edit",
    "users.suspend",
    "companies.verify",
    "listings.view",
    "listings.approve",
    "listings.reject",
    "reports.manage",
    "reviews.manage",
    "categories.manage",
    "notifications.send",
    "finance.manage",
    "audit_logs.view"
  ],
  moderator: ["dashboard.view", "users.view", "listings.view", "listings.approve", "listings.reject", "reports.manage", "reviews.manage"],
  support: ["dashboard.view", "users.view", "reports.manage", "reviews.manage"],
  content_manager: ["dashboard.view", "listings.view", "listings.approve", "listings.reject", "categories.manage"],
  finance: ["dashboard.view", "finance.manage", "audit_logs.view"]
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function parseAdminRole(value: unknown): AdminRole | null {
  return isAdminRole(value) ? value : null;
}

export function permissionsForRole(role: AdminRole): ReadonlyArray<AdminPermission> {
  return ROLE_PERMISSIONS[role];
}

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return permissionsForRole(role).includes(permission);
}
