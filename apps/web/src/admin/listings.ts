import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { ListingStatus } from "@sanany/types";
import { createClient } from "../../utils/supabase/server";

const LISTING_FILTER_STATUSES = ["draft", "available", "reserved", "sold", "inactive"] as const;
type AdminListingFilterStatus = (typeof LISTING_FILTER_STATUSES)[number];

export type AdminListingRow = {
  id: string;
  title: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerUsername: string | null;
  status: ListingStatus;
  price: number;
  locationName: string | null;
  createdAt: string;
};

export type AdminListingsPageData = {
  rows: AdminListingRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminListingDetails = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  ownerDisplayName: string;
  ownerUsername: string | null;
  status: ListingStatus;
  price: number;
  imageUrl: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  images: Array<{
    id: string;
    storagePath: string;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  statusEvents: Array<{
    id: string;
    oldStatus: string;
    newStatus: string;
    createdAt: string;
  }>;
};

export type AdminListingsFilters = {
  q?: string | null;
  status?: string | null;
  owner?: string | null;
  page?: string | null;
};

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseFilterStatus(value: string | null | undefined): AdminListingFilterStatus | null {
  return LISTING_FILTER_STATUSES.find((status) => status === value) ?? null;
}

function parseListingStatus(value: string | null | undefined): ListingStatus {
  return LISTING_FILTER_STATUSES.find((status) => status === value) ?? "draft";
}

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function getAdminListingsPageData(filters: AdminListingsFilters): Promise<AdminListingsPageData> {
  const supabase = await createClient();
  const page = normalizePage(filters.page);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = filters.q?.trim() ?? "";
  const owner = filters.owner?.trim() ?? "";
  const statusFilter = parseFilterStatus(filters.status);

  let ownerIdsFilter: string[] | null = null;
  if (owner.length > 0 && !isUuid(owner)) {
    const ownerPattern = `%${owner}%`;
    const { data: ownerProfiles } = await supabase
      .from("profiles")
      .select("id")
      .or(`display_name.ilike.${ownerPattern},username.ilike.${ownerPattern}`)
      .limit(50);

    ownerIdsFilter = (ownerProfiles ?? []).map((profile) => profile.id);
    if (ownerIdsFilter.length === 0) {
      return {
        rows: [],
        totalItems: 0,
        page,
        pageSize,
        totalPages: 1
      };
    }
  }

  let query = supabase
    .from("listings")
    .select("id,owner_id,title,price,status,image_url,location_name,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q.length > 0) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  if (owner.length > 0) {
    if (isUuid(owner)) {
      query = query.eq("owner_id", owner);
    } else if (ownerIdsFilter) {
      query = query.in("owner_id", ownerIdsFilter);
    }
  }

  const { data, count, error } = await query;
  if (error) {
    return { rows: [], totalItems: 0, page, pageSize, totalPages: 1 };
  }

  const rows = data ?? [];
  const ownerIds = Array.from(new Set(rows.map((row) => row.owner_id).filter((value): value is string => typeof value === "string")));
  const { data: ownerProfiles } =
    ownerIds.length > 0
      ? await supabase.from("profiles").select("id,display_name,username").in("id", ownerIds)
      : { data: [] as Array<{ id: string; display_name: string | null; username: string | null }> };
  const ownerMap = new Map((ownerProfiles ?? []).map((item) => [item.id, item]));

  const totalItems = count ?? 0;
  return {
    rows: rows.map((row) => {
      const ownerProfile = ownerMap.get(row.owner_id ?? "");
      return {
        id: row.id,
        title: row.title ?? row.id,
        ownerId: row.owner_id ?? "",
        ownerDisplayName: ownerProfile?.display_name?.trim() || ownerProfile?.username || row.owner_id || "—",
        ownerUsername: ownerProfile?.username ?? null,
        status: parseListingStatus(row.status),
        price: Number.isFinite(row.price) ? row.price : 0,
        locationName: row.location_name,
        createdAt: row.created_at
      };
    }),
    totalItems,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
  };
}

export async function getAdminListingDetails(listingId: string): Promise<AdminListingDetails | null> {
  const supabase = await createClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id,owner_id,title,description,price,status,image_url,location_name,latitude,longitude,created_at")
    .eq("id", listingId)
    .maybeSingle();

  if (error || !listing) {
    return null;
  }

  const [ownerResult, imagesResult, statusEventsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,username")
      .eq("id", listing.owner_id)
      .maybeSingle(),
    supabase
      .from("listing_images")
      .select("id,storage_path,sort_order,is_primary")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .limit(20),
    supabase
      .from("listing_status_events")
      .select("id,old_status,new_status,created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return {
    id: listing.id,
    title: listing.title ?? listing.id,
    description: listing.description,
    ownerId: listing.owner_id ?? "",
    ownerDisplayName: ownerResult.data?.display_name?.trim() || ownerResult.data?.username || listing.owner_id || "—",
    ownerUsername: ownerResult.data?.username ?? null,
    status: parseListingStatus(listing.status),
    price: Number.isFinite(listing.price) ? listing.price : 0,
    imageUrl: listing.image_url,
    locationName: listing.location_name,
    latitude: listing.latitude,
    longitude: listing.longitude,
    createdAt: listing.created_at,
    images: imagesResult.error
      ? []
      : (imagesResult.data ?? []).map((item) => ({
          id: item.id,
          storagePath: item.storage_path,
          sortOrder: item.sort_order ?? 0,
          isPrimary: Boolean(item.is_primary)
        })),
    statusEvents: statusEventsResult.error
      ? []
      : (statusEventsResult.data ?? []).map((item) => ({
          id: item.id,
          oldStatus: item.old_status ?? "unknown",
          newStatus: item.new_status ?? "unknown",
          createdAt: item.created_at
        }))
  };
}

export async function moderateAdminListingStatus(input: {
  listingId: string;
  nextStatus: Extract<ListingStatus, "available" | "inactive">;
  actorUserId: string;
}): Promise<{ id: string; status: ListingStatus }> {
  const adminClient = requireServiceRoleClient();
  const { data: currentListing, error: currentListingError } = await adminClient
    .from("listings")
    .select("id,owner_id")
    .eq("id", input.listingId)
    .maybeSingle();

  if (currentListingError) {
    throw new Error(currentListingError.message);
  }
  if (!currentListing) {
    throw new Error("Listing was not found.");
  }

  const payload = currentListing.owner_id
    ? { status: input.nextStatus }
    : { status: input.nextStatus, owner_id: input.actorUserId };

  const { data, error } = await adminClient
    .from("listings")
    .update(payload)
    .eq("id", input.listingId)
    .select("id,status")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Listing was not found.");
  }

  return {
    id: data.id,
    status: parseListingStatus(data.status)
  };
}
