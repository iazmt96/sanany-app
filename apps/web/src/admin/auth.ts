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
  if (!raw) return false;
  const normalized = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0)
    .includes(normalized);
}

function isWhitelistedAdminPhone(phone: string): boolean {
  const raw = process.env.SANANY_ADMIN_PHONES;
  if (!raw) return false;
  // Normalize: strip leading zeros and country code for flexible matching
  const normalize = (p: string) => p.trim().replace(/\s+/g, "").replace(/^\+966/, "0").replace(/^966/, "0");
  const normalized = normalize(phone);
  return raw
    .split(",")
    .map((v) => normalize(v))
    .filter((v) => v.length > 0)
    .includes(normalized);
}

export async function getAdminAuthContext(): Promise<AdminAuthContext> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return { status: "unauthenticated" };
  }

  const metadataRole = parseAdminRole(user.app_metadata?.admin_role);

  let whitelistRole: "super_admin" | null = null;
  if (user.email && isWhitelistedAdminEmail(user.email)) {
    whitelistRole = "super_admin";
  } else if (user.phone && isWhitelistedAdminPhone(user.phone)) {
    whitelistRole = "super_admin";
  }

  const role = metadataRole ?? whitelistRole;

  if (!role) {
    return { status: "forbidden" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    user.phone ||
    user.id.slice(0, 8);

  return {
    status: "authorized",
    role,
    displayName,
    email: user.email ?? user.phone ?? user.id,
    userId: user.id
  };
}
