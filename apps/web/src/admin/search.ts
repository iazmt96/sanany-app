import { hasAdminPermission, type AdminRole } from "@sanany/shared";
import { createClient } from "../../utils/supabase/server";

export type AdminSearchResults = {
  users: Array<{ id: string; displayName: string; username: string | null; accountType: string | null }>;
  companies: Array<{ userId: string; companyName: string; verificationStatus: string | null }>;
  listings: Array<{ id: string; title: string; status: string }>;
  reports: Array<{ id: string; status: string | null; reportType: string | null }>;
  reviews: Array<{ id: string; rating: number; comment: string | null }>;
};

const EMPTY_RESULTS: AdminSearchResults = {
  users: [],
  companies: [],
  listings: [],
  reports: [],
  reviews: []
};

function normalizeSearchTerm(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function maybeUuid(term: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term);
}

export async function runAdminGlobalSearch(input: { term: string; role: AdminRole }): Promise<AdminSearchResults> {
  const term = normalizeSearchTerm(input.term);
  if (term.length < 2) {
    return EMPTY_RESULTS;
  }

  const supabase = await createClient();
  const pattern = `%${term}%`;
  const byId = maybeUuid(term);

  const canUsers = hasAdminPermission(input.role, "users.view");
  const canCompanies = hasAdminPermission(input.role, "companies.verify");
  const canListings = hasAdminPermission(input.role, "listings.view");
  const canReports = hasAdminPermission(input.role, "reports.manage");
  const canReviews = hasAdminPermission(input.role, "reviews.manage");

  const [usersResult, companiesResult, listingsResult, reportsResult, reviewsResult] = await Promise.all([
    canUsers
      ? supabase
          .from("profiles")
          .select("id,display_name,username,account_type")
          .or(`display_name.ilike.${pattern},username.ilike.${pattern}`)
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    canCompanies
      ? supabase
          .from("company_profiles")
          .select("user_id,company_name,verification_status")
          .or(`company_name.ilike.${pattern},representative_name.ilike.${pattern}`)
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    canListings
      ? byId
        ? supabase.from("listings").select("id,title,status").eq("id", term).limit(8)
        : supabase.from("listings").select("id,title,status").ilike("title", pattern).limit(8)
      : Promise.resolve({ data: [], error: null }),
    canReports
      ? byId
        ? supabase.from("reports").select("id,status,report_type").eq("id", term).limit(8)
        : supabase.from("reports").select("id,status,report_type").or(`report_type.ilike.${pattern},reason.ilike.${pattern}`).limit(8)
      : Promise.resolve({ data: [], error: null }),
    canReviews
      ? supabase.from("ratings").select("id,rating,comment").ilike("comment", pattern).limit(8)
      : Promise.resolve({ data: [], error: null })
  ]);

  return {
    users: usersResult.error
      ? []
      : (usersResult.data ?? []).map((item) => ({
          id: item.id,
          displayName: item.display_name ?? item.id,
          username: item.username,
          accountType: item.account_type
        })),
    companies: companiesResult.error
      ? []
      : (companiesResult.data ?? []).map((item) => ({
          userId: item.user_id,
          companyName: item.company_name ?? item.user_id,
          verificationStatus: item.verification_status
        })),
    listings: listingsResult.error
      ? []
      : (listingsResult.data ?? []).map((item) => ({
          id: item.id,
          title: item.title ?? item.id,
          status: item.status ?? "unknown"
        })),
    reports: reportsResult.error
      ? []
      : (reportsResult.data ?? []).map((item) => ({
          id: item.id,
          status: item.status,
          reportType: item.report_type
        })),
    reviews: reviewsResult.error
      ? []
      : (reviewsResult.data ?? []).map((item) => ({
          id: item.id,
          rating: item.rating,
          comment: item.comment
        }))
  };
}
