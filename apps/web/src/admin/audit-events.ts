import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const ADMIN_AUDIT_EVENT_TYPES = [
  "admin_announcement_sent",
  "report_status_updated",
  "verification_status_updated",
  "user_role_updated",
  "user_access_updated",
  "review_deleted"
] as const;

export type AdminAuditEventType = (typeof ADMIN_AUDIT_EVENT_TYPES)[number];

type AdminAuditEventInput = {
  actorUserId: string;
  eventType: AdminAuditEventType;
  targetUserId?: string | null;
  targetListingId?: string | null;
  targetReportId?: string | null;
  targetReviewId?: string | null;
  metadata?: Record<string, unknown>;
};

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function recordAdminAuditEvent(input: AdminAuditEventInput): Promise<void> {
  const adminClient = requireServiceRoleClient();
  const { error } = await adminClient.from("admin_audit_events").insert({
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    target_user_id: input.targetUserId ?? null,
    target_listing_id: input.targetListingId ?? null,
    target_report_id: input.targetReportId ?? null,
    target_review_id: input.targetReviewId ?? null,
    metadata: input.metadata ?? {}
  });

  if (error) {
    throw new Error(error.message);
  }
}
