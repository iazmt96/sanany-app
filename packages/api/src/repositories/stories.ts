import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Story,
  StoryMedia,
  StoryAttachedListing,
  StoryHighlight,
  FollowedSellerStories,
  CreateStoryInput,
  CreateHighlightInput,
  AddToHighlightInput,
  ListingStatus,
  MarketplaceListing
} from "@sanany/types";

// ─── Row types ────────────────────────────────────────────────────────────────

type StoryRow = {
  id: string;
  seller_id: string;
  expires_at: string;
  view_count: number;
  created_at: string;
  profiles: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | { id: string; display_name: string | null; username: string | null; avatar_url: string | null }[] | null;
};

type StoryMediaRow = {
  id: string;
  story_id: string;
  media_type: "image" | "video" | "text";
  media_url: string | null;
  text_content: string | null;
  caption: string | null;
  ordinal: number;
  duration_ms: number;
};

type AttachedListingData = {
  id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  status: string;
};

type RawAttachedRow = {
  id: string;
  story_id: string;
  listing_id: string;
  ordinal: number;
  listings: AttachedListingData | AttachedListingData[] | null;
};

type StoryViewRow = {
  story_id: string;
  viewer_id: string;
};

type StoryHighlightRow = {
  id: string;
  seller_id: string;
  title: string;
  cover_url: string | null;
  ordinal: number;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProfile(row: StoryRow) {
  const p = row.profiles;
  if (!p) return null;
  if (Array.isArray(p)) return p[0] ?? null;
  return p;
}

function normalizeAttachedListing(raw: AttachedListingData | AttachedListingData[] | null): AttachedListingData | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function groupBy<T extends Record<string, unknown>>(items: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const k = String(item[key]);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapMedia(row: StoryMediaRow): StoryMedia {
  return {
    id: row.id,
    storyId: row.story_id,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    textContent: row.text_content,
    caption: row.caption,
    ordinal: row.ordinal,
    durationMs: row.duration_ms
  };
}

function mapAttached(raw: RawAttachedRow): StoryAttachedListing {
  const listingData = normalizeAttachedListing(raw.listings);
  return {
    id: raw.id,
    storyId: raw.story_id,
    listingId: raw.listing_id,
    ordinal: raw.ordinal,
    listing: listingData
      ? ({
          id: listingData.id,
          title: listingData.title,
          price: listingData.price ?? 0,
          status: (listingData.status as ListingStatus) ?? "active",
          imageUrl: listingData.image_url ?? null,
          ownerId: null,
          ownerPhone: null,
          description: null,
          locationName: null,
          latitude: null,
          longitude: null,
          createdAt: ""
        } as MarketplaceListing)
      : null
  };
}

function mapStory(
  row: StoryRow,
  media: StoryMedia[],
  attachedListings: StoryAttachedListing[],
  viewedByCurrentUser: boolean
): Story {
  const profile = getProfile(row);
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: profile?.display_name ?? "بائع",
    sellerUsername: profile?.username ?? null,
    sellerAvatarUrl: profile?.avatar_url ?? null,
    expiresAt: row.expires_at,
    viewCount: row.view_count,
    createdAt: row.created_at,
    media,
    attachedListings,
    isViewed: viewedByCurrentUser
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns stories grouped by followed seller, ordered unviewed-first.
 */
export async function getFollowedSellersStories(
  supabase: SupabaseClient,
  userId: string
): Promise<FollowedSellerStories[]> {
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (!follows || follows.length === 0) return [];

  const sellerIds: string[] = (follows as { following_id: string }[]).map((f) => f.following_id);

  const { data: rawStoryRows } = await supabase
    .from("stories")
    .select(`
      id, seller_id, expires_at, view_count, created_at,
      profiles:seller_id ( id, display_name, username, avatar_url )
    `)
    .in("seller_id", sellerIds)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (!rawStoryRows || rawStoryRows.length === 0) return [];

  const storyRows = rawStoryRows as unknown as StoryRow[];
  const storyIds = storyRows.map((s) => s.id);

  const [mediaResult, attachedResult, viewsResult] = await Promise.all([
    supabase
      .from("story_media")
      .select("*")
      .in("story_id", storyIds)
      .order("ordinal", { ascending: true }),
    supabase
      .from("story_attached_listings")
      .select(`id, story_id, listing_id, ordinal, listings:listing_id ( id, title, price, image_url, status )`)
      .in("story_id", storyIds)
      .order("ordinal", { ascending: true }),
    supabase
      .from("story_views")
      .select("story_id, viewer_id")
      .in("story_id", storyIds)
      .eq("viewer_id", userId)
  ]);

  const mediaByStory = groupBy((mediaResult.data ?? []) as StoryMediaRow[], "story_id");
  const attachedByStory = groupBy((attachedResult.data ?? []) as unknown as RawAttachedRow[], "story_id");
  const viewedStoryIds = new Set(((viewsResult.data ?? []) as StoryViewRow[]).map((v) => v.story_id));

  const storiesById = new Map<string, Story>();
  for (const row of storyRows) {
    const media = (mediaByStory[row.id] ?? []).map(mapMedia);
    const attached = (attachedByStory[row.id] ?? []).map(mapAttached);
    storiesById.set(row.id, mapStory(row, media, attached, viewedStoryIds.has(row.id)));
  }

  const bySellerMap = new Map<string, FollowedSellerStories>();
  for (const row of storyRows) {
    const story = storiesById.get(row.id);
    if (!story) continue;
    const profile = getProfile(row);

    if (!bySellerMap.has(row.seller_id)) {
      bySellerMap.set(row.seller_id, {
        sellerId: row.seller_id,
        sellerName: profile?.display_name ?? "بائع",
        sellerUsername: profile?.username ?? null,
        sellerAvatarUrl: profile?.avatar_url ?? null,
        stories: [],
        hasUnviewed: false
      });
    }

    const group = bySellerMap.get(row.seller_id)!;
    group.stories.push(story);
    if (!story.isViewed) group.hasUnviewed = true;
  }

  return Array.from(bySellerMap.values()).sort((a, b) => {
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return 0;
  });
}

/**
 * Get stories for a single seller.
 */
export async function getSellerStories(
  supabase: SupabaseClient,
  sellerId: string,
  currentUserId: string | null
): Promise<Story[]> {
  const { data: rawStoryRows } = await supabase
    .from("stories")
    .select(`
      id, seller_id, expires_at, view_count, created_at,
      profiles:seller_id ( id, display_name, username, avatar_url )
    `)
    .eq("seller_id", sellerId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (!rawStoryRows || rawStoryRows.length === 0) return [];

  const storyRows = rawStoryRows as unknown as StoryRow[];
  const storyIds = storyRows.map((s) => s.id);

  const [mediaResult, attachedResult, viewsResult] = await Promise.all([
    supabase
      .from("story_media")
      .select("*")
      .in("story_id", storyIds)
      .order("ordinal", { ascending: true }),
    supabase
      .from("story_attached_listings")
      .select(`id, story_id, listing_id, ordinal, listings:listing_id ( id, title, price, image_url, status )`)
      .in("story_id", storyIds)
      .order("ordinal", { ascending: true }),
    currentUserId
      ? supabase
          .from("story_views")
          .select("story_id, viewer_id")
          .in("story_id", storyIds)
          .eq("viewer_id", currentUserId)
      : Promise.resolve({ data: [] as StoryViewRow[] })
  ]);

  const mediaByStory = groupBy((mediaResult.data ?? []) as StoryMediaRow[], "story_id");
  const attachedByStory = groupBy((attachedResult.data ?? []) as unknown as RawAttachedRow[], "story_id");
  const viewedIds = new Set(((viewsResult.data ?? []) as StoryViewRow[]).map((v) => v.story_id));

  return storyRows.map((row) => {
    const media = (mediaByStory[row.id] ?? []).map(mapMedia);
    const attached = (attachedByStory[row.id] ?? []).map(mapAttached);
    return mapStory(row, media, attached, viewedIds.has(row.id));
  });
}

/**
 * Create a new story with media and optional attached listings.
 */
export async function createStory(
  supabase: SupabaseClient,
  input: CreateStoryInput
): Promise<Story | null> {
  const { data: storyRow, error: storyError } = await supabase
    .from("stories")
    .insert({ seller_id: input.sellerId })
    .select("id, seller_id, expires_at, view_count, created_at")
    .single();

  if (storyError || !storyRow) return null;

  const storyId: string = storyRow.id;

  if (input.media.length > 0) {
    const mediaRows = input.media.map((m, i) => ({
      story_id: storyId,
      media_type: m.mediaType,
      media_url: m.mediaUrl ?? null,
      text_content: m.textContent ?? null,
      caption: m.caption ?? null,
      ordinal: m.ordinal ?? i,
      duration_ms: m.durationMs ?? 5000
    }));
    await supabase.from("story_media").insert(mediaRows);
  }

  if (input.attachedListingIds && input.attachedListingIds.length > 0) {
    const attachRows = input.attachedListingIds.map((listingId, i) => ({
      story_id: storyId,
      listing_id: listingId,
      ordinal: i
    }));
    await supabase.from("story_attached_listings").insert(attachRows);
  }

  if (input.highlightIds && input.highlightIds.length > 0) {
    const highlightRows = input.highlightIds.map((highlightId) => ({
      highlight_id: highlightId,
      story_id: storyId
    }));
    await supabase.from("story_highlight_items").insert(highlightRows);
  }

  const stories = await getSellerStories(supabase, input.sellerId, input.sellerId);
  return stories.find((s) => s.id === storyId) ?? null;
}

/**
 * Mark a story as viewed by the current user.
 */
export async function markStoryViewed(
  supabase: SupabaseClient,
  storyId: string,
  viewerId: string
): Promise<void> {
  await supabase
    .from("story_views")
    .upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: "story_id,viewer_id" });
}

/**
 * Delete a story (owner only — enforced by RLS).
 */
export async function deleteStory(
  supabase: SupabaseClient,
  storyId: string
): Promise<void> {
  await supabase.from("stories").delete().eq("id", storyId);
}

/**
 * Get story highlights for a seller's profile page.
 */
export async function getSellerHighlights(
  supabase: SupabaseClient,
  sellerId: string
): Promise<StoryHighlight[]> {
  const { data: rows } = await supabase
    .from("story_highlights")
    .select(`
      id, seller_id, title, cover_url, ordinal, created_at,
      story_highlight_items ( story_id, story_media ( id, story_id, media_type, media_url, text_content, caption, ordinal, duration_ms ) )
    `)
    .eq("seller_id", sellerId)
    .order("ordinal", { ascending: true });

  if (!rows) return [];

  return (rows as unknown as Array<StoryHighlightRow & {
    story_highlight_items: Array<{ story_id: string; story_media: StoryMediaRow[] }>;
  }>).map((row) => {
    const storyCount = row.story_highlight_items?.length ?? 0;
    const firstMedia = row.story_highlight_items?.[0]?.story_media?.[0] ?? null;
    return {
      id: row.id,
      sellerId: row.seller_id,
      title: row.title,
      coverUrl: row.cover_url,
      ordinal: row.ordinal,
      createdAt: row.created_at,
      storyCount,
      previewMedia: firstMedia ? mapMedia(firstMedia) : null
    };
  });
}

/**
 * Create a new highlight collection for a seller.
 */
export async function createHighlight(
  supabase: SupabaseClient,
  input: CreateHighlightInput
): Promise<StoryHighlight | null> {
  const { data, error } = await supabase
    .from("story_highlights")
    .insert({
      seller_id: input.sellerId,
      title: input.title,
      cover_url: input.coverUrl ?? null
    })
    .select("id, seller_id, title, cover_url, ordinal, created_at")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    sellerId: data.seller_id,
    title: data.title,
    coverUrl: data.cover_url,
    ordinal: data.ordinal,
    createdAt: data.created_at,
    storyCount: 0,
    previewMedia: null
  };
}

/**
 * Add a story to an existing highlight collection.
 */
export async function addStoryToHighlight(
  supabase: SupabaseClient,
  input: AddToHighlightInput
): Promise<void> {
  await supabase
    .from("story_highlight_items")
    .upsert(
      { highlight_id: input.highlightId, story_id: input.storyId },
      { onConflict: "highlight_id,story_id" }
    );
}

/**
 * Get all stories belonging to a highlight (includes expired stories — highlights persist).
 */
export async function getHighlightStories(
  supabase: SupabaseClient,
  highlightId: string,
  currentUserId: string | null
): Promise<Story[]> {
  const { data: itemRows } = await supabase
    .from("story_highlight_items")
    .select("story_id")
    .eq("highlight_id", highlightId);

  if (!itemRows || itemRows.length === 0) return [];

  const storyIds = (itemRows as { story_id: string }[]).map((r) => r.story_id);

  const { data: rawStoryRows } = await supabase
    .from("stories")
    .select(`
      id, seller_id, expires_at, view_count, created_at,
      profiles:seller_id ( id, display_name, username, avatar_url )
    `)
    .in("id", storyIds)
    .order("created_at", { ascending: false });

  if (!rawStoryRows || rawStoryRows.length === 0) return [];

  const storyRows = rawStoryRows as unknown as StoryRow[];

  const [mediaResult, attachedResult, viewsResult] = await Promise.all([
    supabase
      .from("story_media")
      .select("*")
      .in("story_id", storyIds)
      .order("ordinal", { ascending: true }),
    supabase
      .from("story_attached_listings")
      .select(`id, story_id, listing_id, ordinal, listings:listing_id ( id, title, price, image_url, status )`)
      .in("story_id", storyIds)
      .order("ordinal", { ascending: true }),
    currentUserId
      ? supabase
          .from("story_views")
          .select("story_id, viewer_id")
          .in("story_id", storyIds)
          .eq("viewer_id", currentUserId)
      : Promise.resolve({ data: [] as StoryViewRow[] })
  ]);

  const mediaByStory = groupBy((mediaResult.data ?? []) as StoryMediaRow[], "story_id");
  const attachedByStory = groupBy((attachedResult.data ?? []) as unknown as RawAttachedRow[], "story_id");
  const viewedIds = new Set(((viewsResult.data ?? []) as StoryViewRow[]).map((v) => v.story_id));

  return storyRows.map((row) => {
    const media = (mediaByStory[row.id] ?? []).map(mapMedia);
    const attached = (attachedByStory[row.id] ?? []).map(mapAttached);
    return mapStory(row, media, attached, viewedIds.has(row.id));
  });
}