import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateSellerRatingInput,
  MarketplaceListing,
  PaginatedResult,
  SellerConnection,
  SellerProfile,
  SellerProfileListingsSort,
  SellerProfileListingsTab,
  SellerProfileRatingsSort,
  SellerRating
} from "@sanany/types";

type SellerProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  account_type: SellerProfile["accountType"] | null;
  is_verified: boolean | null;
  joined_at: string | null;
  last_seen_at: string | null;
  show_last_seen: boolean | null;
  show_phone: boolean | null;
  phone: string | null;
};

type SellerStatsRow = {
  seller_id: string;
  listings_count: number | null;
  sold_listings_count: number | null;
  followers_count: number | null;
  following_count: number | null;
  rating_count: number | null;
  rating_average: number | null;
};

type FollowRow = {
  follower_id: string;
  following_id: string;
  profile: Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    account_type: SellerProfile["accountType"] | null;
    is_verified: boolean | null;
  }>;
};

type CompanyProfileRow = {
  business_type: string | null;
  custom_business_type: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected" | null;
};

type RatingRow = {
  id: string;
  seller_id: string;
  rater_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_name: string | null;
  rater_avatar_url: string | null;
};

type ListingRow = {
  id: string;
  owner_id: string | null;
  owner_phone?: string | null;
  title: string;
  description: string | null;
  price: number;
  status: MarketplaceListing["status"];
  image_url: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
};

const LISTING_SELECT = "id,owner_id,owner_phone,title,description,price,status,image_url,location_name,latitude,longitude,created_at";
const LISTING_SELECT_LEGACY = "id,owner_id,title,description,price,status,image_url,created_at";

function mapFollowRowsToConnections(rows: FollowRow[]): SellerConnection[] {
  return rows
    .map((row) => row.profile[0] ?? null)
    .filter((value): value is NonNullable<(typeof rows)[number]["profile"][number]> => Boolean(value))
    .map((profile) => ({
      id: profile.id,
      displayName: profile.display_name ?? profile.username ?? "SANANY",
      username: profile.username,
      avatarUrl: profile.avatar_url,
      accountType: profile.account_type ?? "individual",
      isVerified: profile.is_verified ?? false
    }));
}

function isMissingListingsColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const payload = error as { code?: string; message?: string };
  const message = typeof payload.message === "string" ? payload.message : "";
  const isPostgresMissingColumn = payload.code === "42703" && message.includes("column listings.");
  const isPostgrestSchemaCacheMissingColumn =
    message.includes("column of 'listings'") && message.toLowerCase().includes("schema cache");
  return isPostgresMissingColumn || isPostgrestSchemaCacheMissingColumn;
}

function mapListingRow(row: ListingRow): MarketplaceListing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerPhone: row.owner_phone ?? null,
    title: row.title,
    description: row.description,
    price: row.price,
    status: row.status,
    imageUrl: row.image_url,
    locationName: row.location_name ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    createdAt: row.created_at
  };
}

export type SellersRepository = {
  getProfile(sellerId: string, viewerId?: string | null): Promise<SellerProfile | null>;
  setFollow(sellerId: string, followerId: string, follow: boolean): Promise<void>;
  listFollowers(input: { sellerId: string; page: number; pageSize: number }): Promise<PaginatedResult<SellerConnection>>;
  listFollowing(input: { userId: string; page: number; pageSize: number }): Promise<PaginatedResult<SellerConnection>>;
  listSellerListings(input: {
    sellerId: string;
    viewerId?: string | null;
    tab: SellerProfileListingsTab;
    sort: SellerProfileListingsSort;
    page: number;
    pageSize: number;
  }): Promise<PaginatedResult<MarketplaceListing>>;
  listSellerRatings(input: {
    sellerId: string;
    sort: SellerProfileRatingsSort;
    page: number;
    pageSize: number;
  }): Promise<PaginatedResult<SellerRating>>;
  saveRating(input: CreateSellerRatingInput): Promise<void>;
};

export function createSellersRepository(client: SupabaseClient): SellersRepository {
  return {
    async getProfile(sellerId, viewerId = null) {
      const [profileResult, statsResult] = await Promise.all([
        client
          .from("profiles")
          .select("id,username,display_name,avatar_url,bio,city,account_type,is_verified,joined_at,last_seen_at,show_last_seen,show_phone,phone")
          .eq("id", sellerId)
          .maybeSingle(),
        client.from("seller_profile_stats").select("*").eq("seller_id", sellerId).maybeSingle()
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }
      if (statsResult.error) {
        throw statsResult.error;
      }

      const row = profileResult.data as SellerProfileRow | null;
      if (!row) {
        return null;
      }

      let isFollowing = false;
      if (viewerId && viewerId !== sellerId) {
        const followResult = await client
          .from("follows")
          .select("follower_id,following_id")
          .eq("follower_id", viewerId)
          .eq("following_id", sellerId)
          .maybeSingle();

        if (followResult.error) {
          throw followResult.error;
        }
        isFollowing = Boolean(followResult.data as FollowRow | null);
      }

      let companyProfile: CompanyProfileRow | null = null;
      if (row.account_type === "company") {
        const companyProfileResult = await client
          .from("company_profiles")
          .select("business_type,custom_business_type,verification_status")
          .eq("user_id", sellerId)
          .maybeSingle();
        if (companyProfileResult.error) {
          throw companyProfileResult.error;
        }
        companyProfile = (companyProfileResult.data as CompanyProfileRow | null) ?? null;
      }

      const stats = (statsResult.data as SellerStatsRow | null) ?? null;
      const displayName = (row.display_name && row.display_name.trim()) || row.username || "SANANY";

      return {
        id: row.id,
        displayName,
        username: row.username,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        city: row.city,
        accountType: row.account_type ?? "individual",
        isVerified: row.is_verified ?? false,
        ratingAverage: stats?.rating_average ?? 0,
        ratingCount: stats?.rating_count ?? 0,
        listingsCount: stats?.listings_count ?? 0,
        soldListingsCount: stats?.sold_listings_count ?? 0,
        followersCount: stats?.followers_count ?? 0,
        followingCount: stats?.following_count ?? 0,
        joinedAt: row.joined_at ?? new Date(0).toISOString(),
        lastSeenAt: row.last_seen_at,
        isFollowing,
        isOwner: viewerId === sellerId,
        canShowLastSeen: row.show_last_seen ?? false,
        canShowPhone: row.show_phone ?? false,
        phone: row.phone,
        companyBusinessType: companyProfile?.custom_business_type ?? companyProfile?.business_type ?? null,
        companyVerificationStatus: companyProfile?.verification_status ?? null
      };
    },
    async setFollow(sellerId, followerId, follow) {
      if (sellerId === followerId) {
        throw new Error("Cannot follow yourself.");
      }

      if (follow) {
        const { error } = await client.from("follows").insert({ follower_id: followerId, following_id: sellerId });
        if (error) {
          throw error;
        }
        return;
      }

      const { error } = await client
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("following_id", sellerId);
      if (error) {
        throw error;
      }
    },
    async listFollowers({ sellerId, page, pageSize }) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;
      const { data, error, count } = await client
        .from("follows")
        .select("follower_id,following_id,profile:profiles!follows_follower_id_fkey(id,username,display_name,avatar_url,account_type,is_verified)", {
          count: "exact"
        })
        .eq("following_id", sellerId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as FollowRow[];
      const items = mapFollowRowsToConnections(rows);
      const totalItems = count ?? 0;
      return {
        items,
        totalItems,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
      };
    },
    async listFollowing({ userId, page, pageSize }) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;
      const { data, error, count } = await client
        .from("follows")
        .select("follower_id,following_id,profile:profiles!follows_following_id_fkey(id,username,display_name,avatar_url,account_type,is_verified)", {
          count: "exact"
        })
        .eq("follower_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as FollowRow[];
      const items = mapFollowRowsToConnections(rows);
      const totalItems = count ?? 0;
      return {
        items,
        totalItems,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
      };
    },
    async listSellerListings({ sellerId, viewerId = null, tab, sort, page, pageSize }) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 12;
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;
      const isOwner = Boolean(viewerId) && viewerId === sellerId;

      const buildQuery = (selectClause: string) => {
        let query = client
          .from("listings")
          .select(selectClause, { count: "exact" })
          .eq("owner_id", sellerId)
          .range(from, to);

        if (tab === "available") {
          query = query.eq("status", "available");
        } else if (tab === "sold") {
          query = query.in("status", isOwner ? ["reserved", "inactive"] : ["reserved"]);
        } else {
          query = query.in("status", isOwner ? ["available", "reserved", "inactive", "draft"] : ["available", "reserved"]);
        }

        if (sort === "oldest") {
          query = query.order("created_at", { ascending: true });
        } else if (sort === "priceLow") {
          query = query.order("price", { ascending: true }).order("created_at", { ascending: false });
        } else if (sort === "priceHigh") {
          query = query.order("price", { ascending: false }).order("created_at", { ascending: false });
        } else {
          query = query.order("created_at", { ascending: false });
        }

        return query;
      };

      let { data, error, count } = await buildQuery(LISTING_SELECT);
      if (error && isMissingListingsColumnError(error)) {
        ({ data, error, count } = await buildQuery(LISTING_SELECT_LEGACY));
      }
      if (error) {
        throw error;
      }

      const totalItems = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
      const rows = (data ?? []) as unknown as ListingRow[];

      return {
        items: rows.map((row) => mapListingRow(row)),
        totalItems,
        page: safePage,
        pageSize: safePageSize,
        totalPages
      };
    },
    async listSellerRatings({ sellerId, sort, page, pageSize }) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      let query = client
        .from("ratings_with_profiles")
        .select("id,seller_id,rater_id,listing_id,rating,comment,created_at,rater_name,rater_avatar_url", { count: "exact" })
        .eq("seller_id", sellerId)
        .range(from, to);

      if (sort === "highest") {
        query = query.order("rating", { ascending: false }).order("created_at", { ascending: false });
      } else if (sort === "lowest") {
        query = query.order("rating", { ascending: true }).order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error, count } = await query;
      if (error) {
        throw error;
      }

      const rows = (data ?? []) as unknown as RatingRow[];
      const items: SellerRating[] = rows.map((row) => ({
        id: row.id,
        sellerId: row.seller_id,
        raterId: row.rater_id,
        listingId: row.listing_id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
        raterName: row.rater_name,
        raterAvatarUrl: row.rater_avatar_url
      }));

      const totalItems = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));

      return {
        items,
        totalItems,
        page: safePage,
        pageSize: safePageSize,
        totalPages
      };
    },
    async saveRating({ sellerId, raterId, rating, comment, listingId }) {
      if (sellerId === raterId) {
        throw new Error("Cannot rate yourself.");
      }
      const normalizedRating = Math.max(1, Math.min(5, Math.round(rating)));
      const normalizedComment = (comment ?? "").trim();
      const { data: existing, error: existingError } = await client
        .from("ratings")
        .select("id")
        .eq("seller_id", sellerId)
        .eq("rater_id", raterId)
        .is("listing_id", listingId ?? null)
        .maybeSingle();
      if (existingError) {
        throw existingError;
      }
      if (existing) {
        const { error } = await client
          .from("ratings")
          .update({
            rating: normalizedRating,
            comment: normalizedComment.length > 0 ? normalizedComment : null
          })
          .eq("id", existing.id);
        if (error) {
          throw error;
        }
        return;
      }
      const { error } = await client.from("ratings").insert({
        seller_id: sellerId,
        rater_id: raterId,
        listing_id: listingId ?? null,
        rating: normalizedRating,
        comment: normalizedComment.length > 0 ? normalizedComment : null
      });
      if (error) {
        throw error;
      }
    }
  };
}
