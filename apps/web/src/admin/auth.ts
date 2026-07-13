import { parseAdminRole, type AdminRole } from "@sanany/shared";
import { createClient } from "../../utils/supabase/server";

type AdminAuthContext =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | {
      status: "authorized";
      role: AdminRole;
      displayName: string;
      email: string;
      userId: string;
    };

function isWhitelistedAdminEmail(email: string): boolean {
  const raw = process.env.SANANY_ADMIN_EMAILS;
  if (!raw) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .includes(normalized);
}

export async function getAdminAuthContext(): Promise<AdminAuthContext> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user || !user.email) {
    return { status: "unauthenticated" };
  }

  const metadataRole = parseAdminRole(user.app_metadata?.admin_role);
  const role = metadataRole ?? (isWhitelistedAdminEmail(user.email) ? "super_admin" : null);

  if (!role) {
    return { status: "forbidden" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name?.trim() || user.user_metadata?.display_name || user.email.split("@")[0];

  return {
    status: "authorized",
    role,
    displayName,
    email: user.email,
    userId: user.id
  };
}
