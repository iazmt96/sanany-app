import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateListingInput, CreateListingImageInput, ListingsQuery, MarketplaceListing, PaginatedResult } from "@sanany/types";
import { LISTING_IMAGES_BUCKET, escapeListingsSearchTerm, normalizeListingsQuery } from "@sanany/shared";

export type ListingsRepository = {
  list(query: ListingsQuery): Promise<PaginatedResult<MarketplaceListing>>;
  create(input: CreateListingInput): Promise<MarketplaceListing>;
  saveDraft(input: CreateListingInput & { id?: string }): Promise<MarketplaceListing>;
  publishDraft(input: CreateListingInput & { id?: string }): Promise<MarketplaceListing>;
  getById(id: string): Promise<MarketplaceListing | null>;
  listByOwner(ownerId: string, query: ListingsQuery): Promise<PaginatedResult<MarketplaceListing>>;
  deleteById(id: string, ownerId: string): Promise<void>;
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
  updated_at?: string;
};

const LISTING_SELECT_WITH_OWNER_PHONE = "id,owner_id,owner_phone,title,description,price,status,image_url,location_name,latitude,longitude,created_at,updated_at";
const LISTING_SELECT_LEGACY = "id,owner_id,title,description,price,status,image_url,created_at,updated_at";

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

function mapRow(row: ListingRow): MarketplaceListing {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeCreateImages(images: CreateListingImageInput[] | undefined): CreateListingImageInput[] {
  if (!images || images.length === 0) {
    return [];
  }

  const ordered = [...images]
    .filter((image) => image.storagePath.trim().length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image, index) => ({
      ...image,
      storagePath: image.storagePath.trim(),
      sortOrder: index,
      isPrimary: image.isPrimary
    }));

  if (ordered.length === 0) {
    return [];
  }

  const primaryIndex = ordered.findIndex((image) => image.isPrimary);
  if (primaryIndex === -1) {
    ordered[0].isPrimary = true;
  } else {
    for (let index = 0; index < ordered.length; index += 1) {
      ordered[index].isPrimary = index === primaryIndex;
    }
  }

  return ordered;
}

function buildListingCreatePayload(input: CreateListingInput, status: MarketplaceListing["status"]) {
  return {
    title: input.title.trim(),
    description: input.description.trim() || null,
    price: input.price,
    status,
    image_url: input.imageUrl ?? null,
    location_name: input.locationName ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    owner_phone: input.ownerPhone ?? null,
    owner_id: input.ownerId
  };
}

function buildListingLegacyCreatePayload(input: CreateListingInput, status: MarketplaceListing["status"]) {
  return {
    title: input.title.trim(),
    description: input.description.trim() || null,
    price: input.price,
    status,
    image_url: input.imageUrl ?? null,
    owner_id: input.ownerId
  };
}

async function createListingRow(client: SupabaseClient, input: CreateListingInput, status: MarketplaceListing["status"]) {
  const { data, error } = await client
    .from("listings")
    .insert(buildListingCreatePayload(input, status))
    .select(LISTING_SELECT_WITH_OWNER_PHONE)
    .single();

  if (error && isMissingListingsColumnError(error)) {
    const legacyInsert = await client
      .from("listings")
      .insert(buildListingLegacyCreatePayload(input, status))
      .select(LISTING_SELECT_LEGACY)
      .single();

    if (legacyInsert.error) {
      throw legacyInsert.error;
    }

    return legacyInsert.data as ListingRow;
  }

  if (error) {
    throw error;
  }

  return data as ListingRow;
}

async function removeListingStorageObjects(client: SupabaseClient, storagePaths: string[]) {
  if (storagePaths.length === 0) {
    return;
  }
  await client.storage.from(LISTING_IMAGES_BUCKET).remove(storagePaths);
}

async function syncListingImagesForListing(client: SupabaseClient, input: {
  listingId: string;
  ownerId: string;
  images: CreateListingImageInput[];
}) {
  const existingImagesResult = await client
    .from("listing_images")
    .select("storage_path")
    .eq("listing_id", input.listingId)
    .eq("user_id", input.ownerId);
  if (existingImagesResult.error) {
    throw existingImagesResult.error;
  }

  const existingStoragePaths = new Set((existingImagesResult.data ?? []).map((item) => item.storage_path));
  const nextStoragePaths = new Set(input.images.map((item) => item.storagePath));
  const removedStoragePaths = Array.from(existingStoragePaths).filter((path) => !nextStoragePaths.has(path));

  const deleteRowsResult = await client.from("listing_images").delete().eq("listing_id", input.listingId).eq("user_id", input.ownerId);
  if (deleteRowsResult.error) {
    throw deleteRowsResult.error;
  }

  if (input.images.length > 0) {
    const listingImageRows = input.images.map((image) => ({
      listing_id: input.listingId,
      user_id: input.ownerId,
      storage_path: image.storagePath,
      sort_order: image.sortOrder,
      is_primary: image.isPrimary,
      width: image.width ?? null,
      height: image.height ?? null,
      file_size: image.fileSize ?? null,
      mime_type: image.mimeType ?? null
    }));
    const insertImagesResult = await client.from("listing_images").insert(listingImageRows);
    if (insertImagesResult.error) {
      throw insertImagesResult.error;
    }
  }

  await removeListingStorageObjects(client, removedStoragePaths);
}

export function createListingsRepository(client: SupabaseClient): ListingsRepository {
  return {
    async list(query) {
      const normalizedQuery = normalizeListingsQuery(query);
      const from = (normalizedQuery.page - 1) * normalizedQuery.pageSize;
      const to = from + normalizedQuery.pageSize - 1;

      const buildQuery = (selectClause: string) => {
        let supabaseQuery = client
          .from("listings")
          .select(selectClause, { count: "exact" })
          .range(from, to);

        if (normalizedQuery.sort === "priceHigh") {
          supabaseQuery = supabaseQuery.order("price", { ascending: false }).order("created_at", { ascending: false });
        } else if (normalizedQuery.sort === "priceLow") {
          supabaseQuery = supabaseQuery.order("price", { ascending: true }).order("created_at", { ascending: false });
        } else {
          supabaseQuery = supabaseQuery.order("created_at", { ascending: false });
        }

        if (normalizedQuery.status !== "all") {
          supabaseQuery = supabaseQuery.eq("status", normalizedQuery.status);
        } else {
          supabaseQuery = supabaseQuery.in("status", ["available", "reserved"]);
        }

        if (normalizedQuery.search) {
          const escapedSearch = escapeListingsSearchTerm(normalizedQuery.search);
          supabaseQuery = supabaseQuery.or(`title.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`);
        }

        return supabaseQuery;
      };

      let { data, error, count } = await buildQuery(LISTING_SELECT_WITH_OWNER_PHONE);
      if (error && isMissingListingsColumnError(error)) {
        ({ data, error, count } = await buildQuery(LISTING_SELECT_LEGACY));
      }

      if (error) {
        throw error;
      }

      const totalItems = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalItems / normalizedQuery.pageSize));
      const rows = (data ?? []) as unknown as ListingRow[];

      return {
        items: rows.map((row) => mapRow(row)),
        totalItems,
        page: normalizedQuery.page,
        pageSize: normalizedQuery.pageSize,
        totalPages
      };
    },
    async create(input) {
      const normalizedImages = normalizeCreateImages(input.images);
      const data = await createListingRow(client, input, input.status ?? "available");

      if (normalizedImages.length > 0) {
        const listingId = (data as ListingRow).id;
        try {
          await syncListingImagesForListing(client, {
            listingId,
            ownerId: input.ownerId,
            images: normalizedImages
          });
        } catch (error) {
          await client.from("listings").delete().eq("id", listingId).eq("owner_id", input.ownerId);
          await removeListingStorageObjects(client, normalizedImages.map((image) => image.storagePath));
          throw error;
        }
      }

      return mapRow(data);
    },
    async saveDraft(input) {
      const desiredStatus: MarketplaceListing["status"] = "draft";
      if (input.id) {
        let updateResult = await client
          .from("listings")
          .update(buildListingCreatePayload(input, desiredStatus))
          .eq("id", input.id)
          .eq("owner_id", input.ownerId)
          .select(LISTING_SELECT_WITH_OWNER_PHONE)
          .maybeSingle();

        if (updateResult.error && isMissingListingsColumnError(updateResult.error)) {
          updateResult = await client
            .from("listings")
            .update(buildListingLegacyCreatePayload(input, desiredStatus))
            .eq("id", input.id)
            .eq("owner_id", input.ownerId)
            .select(LISTING_SELECT_LEGACY)
            .maybeSingle();
        }

        if (updateResult.error) {
          throw updateResult.error;
        }
        if (updateResult.data) {
          if (input.images) {
            await syncListingImagesForListing(client, {
              listingId: (updateResult.data as ListingRow).id,
              ownerId: input.ownerId,
              images: normalizeCreateImages(input.images)
            });
          }
          return mapRow(updateResult.data as ListingRow);
        }
      }

      return mapRow(await createListingRow(client, input, desiredStatus));
    },
    async publishDraft(input) {
      const desiredStatus: MarketplaceListing["status"] = input.status && input.status !== "draft" ? input.status : "available";
      if (input.id) {
        let updateResult = await client
          .from("listings")
          .update(buildListingCreatePayload(input, desiredStatus))
          .eq("id", input.id)
          .eq("owner_id", input.ownerId)
          .select(LISTING_SELECT_WITH_OWNER_PHONE)
          .maybeSingle();

        if (updateResult.error && isMissingListingsColumnError(updateResult.error)) {
          updateResult = await client
            .from("listings")
            .update(buildListingLegacyCreatePayload(input, desiredStatus))
            .eq("id", input.id)
            .eq("owner_id", input.ownerId)
            .select(LISTING_SELECT_LEGACY)
            .maybeSingle();
        }

        if (updateResult.error) {
          throw updateResult.error;
        }
        if (updateResult.data) {
          if (input.images) {
            await syncListingImagesForListing(client, {
              listingId: (updateResult.data as ListingRow).id,
              ownerId: input.ownerId,
              images: normalizeCreateImages(input.images)
            });
          }
          return mapRow(updateResult.data as ListingRow);
        }
      }

      return mapRow(await createListingRow(client, input, desiredStatus));
    },
    async getById(id) {
      let { data, error } = await client
        .from("listings")
        .select(LISTING_SELECT_WITH_OWNER_PHONE)
        .eq("id", id)
        .maybeSingle();

      if (error && isMissingListingsColumnError(error)) {
        ({ data, error } = await client
          .from("listings")
          .select(LISTING_SELECT_LEGACY)
          .eq("id", id)
          .maybeSingle());
      }

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return mapRow(data as ListingRow);
    },
    async listByOwner(ownerId, query) {
      const normalizedQuery = normalizeListingsQuery(query);
      const from = (normalizedQuery.page - 1) * normalizedQuery.pageSize;
      const to = from + normalizedQuery.pageSize - 1;

      const buildOwnerQuery = (selectClause: string) => {
        let supabaseQuery = client
          .from("listings")
          .select(selectClause, { count: "exact" })
          .eq("owner_id", ownerId)
          .range(from, to);

        if (normalizedQuery.sort === "priceHigh") {
          supabaseQuery = supabaseQuery.order("price", { ascending: false }).order("created_at", { ascending: false });
        } else if (normalizedQuery.sort === "priceLow") {
          supabaseQuery = supabaseQuery.order("price", { ascending: true }).order("created_at", { ascending: false });
        } else {
          supabaseQuery = supabaseQuery.order("created_at", { ascending: false });
        }

        if (normalizedQuery.status !== "all") {
          supabaseQuery = supabaseQuery.eq("status", normalizedQuery.status);
        }

        if (normalizedQuery.search) {
          const escapedSearch = escapeListingsSearchTerm(normalizedQuery.search);
          supabaseQuery = supabaseQuery.or(`title.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`);
        }

        return supabaseQuery;
      };

      let { data, error, count } = await buildOwnerQuery(LISTING_SELECT_WITH_OWNER_PHONE);
      if (error && isMissingListingsColumnError(error)) {
        ({ data, error, count } = await buildOwnerQuery(LISTING_SELECT_LEGACY));
      }

      if (error) {
        throw error;
      }

      const totalItems = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalItems / normalizedQuery.pageSize));
      const rows = (data ?? []) as unknown as ListingRow[];

      return {
        items: rows.map((row) => mapRow(row)),
        totalItems,
        page: normalizedQuery.page,
        pageSize: normalizedQuery.pageSize,
        totalPages
      };
    },
    async deleteById(id, ownerId) {
      const { error } = await client
        .from("listings")
        .delete()
        .eq("id", id)
        .eq("owner_id", ownerId);

      if (error) {
        throw error;
      }
    }
  };
}
