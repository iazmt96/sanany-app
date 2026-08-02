import { ADMIN_ROLES, permissionsForRole, type AdminRole } from "@sanany/shared";
import { defaultLanguage, languages } from "@sanany/utils";
import { createClient } from "../../utils/supabase/server";

export type AdminSettingsStatus = "configured" | "missing";

export type AdminSettingsFlag = {
  key:
    | "supabaseUrl"
    | "publishableKey"
    | "serviceRoleKey"
    | "adminWhitelist"
    | "defaultLanguage"
    | "supportedLanguages";
  status: AdminSettingsStatus;
  value: string;
};

export type AdminRoleSummary = {
  role: AdminRole;
  permissionsCount: number;
  permissions: string[];
};

export type AdminSettingsMetric = {
  key: "profiles" | "companies" | "listings" | "reports";
  value: number | null;
};

export type AdminSettingsData = {
  flags: AdminSettingsFlag[];
  roleSummaries: AdminRoleSummary[];
  metrics: AdminSettingsMetric[];
};

function toStatus(value: string | undefined): AdminSettingsStatus {
  return value && value.trim().length > 0 ? "configured" : "missing";
}

function maskUrlHost(value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    return "—";
  }

  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function countConfiguredAdmins(raw: string | undefined): number {
  if (!raw) {
    return 0;
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0).length;
}

async function countRows(table: "profiles" | "company_profiles" | "listings" | "reports"): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      return null;
    }
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function getAdminSettingsData(): Promise<AdminSettingsData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmails = process.env.SANANY_ADMIN_EMAILS;

  const [profilesCount, companiesCount, listingsCount, reportsCount] = await Promise.all([
    countRows("profiles"),
    countRows("company_profiles"),
    countRows("listings"),
    countRows("reports")
  ]);

  return {
    flags: [
      {
        key: "supabaseUrl",
        status: toStatus(supabaseUrl),
        value: maskUrlHost(supabaseUrl)
      },
      {
        key: "publishableKey",
        status: toStatus(publishableKey),
        value: ""
      },
      {
        key: "serviceRoleKey",
        status: toStatus(serviceRoleKey),
        value: ""
      },
      {
        key: "adminWhitelist",
        status: countConfiguredAdmins(adminEmails) > 0 ? "configured" : "missing",
        value: String(countConfiguredAdmins(adminEmails))
      },
      {
        key: "defaultLanguage",
        status: "configured",
        value: defaultLanguage
      },
      {
        key: "supportedLanguages",
        status: languages.length > 0 ? "configured" : "missing",
        value: languages.join(", ")
      }
    ],
    roleSummaries: ADMIN_ROLES.map((role) => ({
      role,
      permissionsCount: permissionsForRole(role).length,
      permissions: [...permissionsForRole(role)]
    })),
    metrics: [
      { key: "profiles", value: profilesCount },
      { key: "companies", value: companiesCount },
      { key: "listings", value: listingsCount },
      { key: "reports", value: reportsCount }
    ]
  };
}
