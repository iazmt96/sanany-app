import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateListingInput,
  CreateListingImageInput,
  ListingAttributes,
  ListingSaleInvoice,
  ListingSalePayment,
  ListingSalePaymentStatus,
  ListingSaleSource,
  ListingsQuery,
  MarketplaceCommissionSettings,
  MarketplaceListing,
  PaginatedResult
} from "@sanany/types";
import { LISTING_IMAGES_BUCKET, escapeListingsSearchTerm, normalizeListingsQuery } from "@sanany/shared";

export type ListingsRepository = {
  list(query: ListingsQuery): Promise<PaginatedResult<MarketplaceListing>>;
  create(input: CreateListingInput): Promise<MarketplaceListing>;
  saveDraft(input: CreateListingInput & { id?: string }): Promise<MarketplaceListing>;
  publishDraft(input: CreateListingInput & { id?: string }): Promise<MarketplaceListing>;
  getById(id: string): Promise<MarketplaceListing | null>;
  listByOwner(ownerId: string, query: ListingsQuery): Promise<PaginatedResult<MarketplaceListing>>;
  getCommissionSettings(): Promise<MarketplaceCommissionSettings>;
  listSalePaymentsBySeller(sellerId: string): Promise<ListingSalePayment[]>;
  prepareSalePayment(input: {
    listingId: string;
    sellerId: string;
    finalSaleAmount: number;
    saleSource: ListingSaleSource;
    saleSourceOther?: string | null;
    buyerName?: string | null;
    buyerPhone?: string | null;
  }): Promise<ListingSalePayment>;
  finalizeSalePayment(input: {
    listingId: string;
    sellerId: string;
    outcome: Extract<ListingSalePaymentStatus, "paid" | "failed" | "cancelled">;
    paymentMethod?: string | null;
    failureReason?: string | null;
  }): Promise<ListingSalePayment>;
  getSaleInvoice(listingId: string, sellerId: string): Promise<ListingSaleInvoice | null>;
  deleteById(id: string, ownerId: string): Promise<void>;
};

type ListingRow = {
  id: string;
  owner_id: string | null;
  owner_phone?: string | null;
  offer_type?: MarketplaceListing["offerType"];
  category_slug?: string | null;
  title: string;
  description: string | null;
  price: number;
  status: MarketplaceListing["status"];
  image_url: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attributes?: ListingAttributes | null;
  created_at: string;
  updated_at?: string;
};

type CommissionSettingsRow = {
  commission_rate_percent: number;
  updated_at: string;
};

type SalePaymentRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  sale_source: ListingSaleSource;
  sale_source_other: string | null;
  final_sale_amount: number;
  commission_rate_percent: number;
  commission_amount: number;
  buyer_name: string | null;
  buyer_phone: string | null;
  payment_status: ListingSalePaymentStatus;
  payment_method: string | null;
  payment_date: string | null;
  invoice_number: string | null;
  transaction_reference: string | null;
  failure_reason: string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

type SaleInvoiceRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  sale_source: ListingSaleSource;
  sale_source_other: string | null;
  final_sale_amount: number;
  commission_rate_percent: number;
  commission_amount: number;
  buyer_name: string | null;
  buyer_phone: string | null;
  payment_status: ListingSalePaymentStatus;
  payment_method: string | null;
  payment_date: string | null;
  invoice_number: string | null;
  transaction_reference: string | null;
  failure_reason: string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
  listing: {
    id: string;
    title: string | null;
    image_url: string | null;
  } | null;
  seller:
    | {
        display_name: string | null;
        username: string | null;
      }
    | {
        display_name: string | null;
        username: string | null;
      }[]
    | null;
};

const LISTING_SELECT_WITH_OWNER_PHONE = "id,owner_id,owner_phone,offer_type,category_slug,title,description,price,status,image_url,location_name,latitude,longitude,attributes,created_at,updated_at";
const LISTING_SELECT_LEGACY = "id,owner_id,title,description,price,status,image_url,created_at,updated_at";
const SALE_PAYMENT_SELECT =
  "id,listing_id,seller_id,sale_source,sale_source_other,final_sale_amount,commission_rate_percent,commission_amount,buyer_name,buyer_phone,payment_status,payment_method,payment_date,invoice_number,transaction_reference,failure_reason,refund_reason,refunded_at,created_at,updated_at";

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

function isMissingListingImagesTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const payload = error as { code?: string; message?: string };
  const message = typeof payload.message === "string" ? payload.message : "";
  const normalizedMessage = message.toLowerCase();
  const isPostgrestMissingTable =
    payload.code === "PGRST205" &&
    normalizedMessage.includes("public.listing_images") &&
    normalizedMessage.includes("schema cache");
  const isPostgresMissingTable = payload.code === "42P01" && normalizedMessage.includes("listing_images");
  return isPostgrestMissingTable || isPostgresMissingTable;
}

function mapRow(row: ListingRow): MarketplaceListing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerPhone: row.owner_phone ?? null,
    offerType: row.offer_type ?? null,
    categorySlug: row.category_slug ?? null,
    title: row.title,
    description: row.description,
    price: row.price,
    status: row.status,
    imageUrl: row.image_url,
    locationName: row.location_name ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    attributes: row.attributes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSalePaymentRow(row: SalePaymentRow): ListingSalePayment {
  return {
    id: row.id,
    listingId: row.listing_id,
    sellerId: row.seller_id,
    saleSource: row.sale_source,
    saleSourceOther: row.sale_source_other ?? null,
    finalSaleAmount: Number(row.final_sale_amount ?? 0),
    commissionRatePercent: Number(row.commission_rate_percent ?? 0),
    commissionAmount: Number(row.commission_amount ?? 0),
    buyerName: row.buyer_name ?? null,
    buyerPhone: row.buyer_phone ?? null,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method ?? null,
    paymentDate: row.payment_date ?? null,
    invoiceNumber: row.invoice_number ?? null,
    transactionReference: row.transaction_reference ?? null,
    failureReason: row.failure_reason ?? null,
    refundReason: row.refund_reason ?? null,
    refundedAt: row.refunded_at ?? null,
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
    offer_type: input.offerType ?? null,
    category_slug: input.categorySlug ?? null,
    image_url: input.imageUrl ?? null,
    location_name: input.locationName ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    attributes: input.attributes ?? {},
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
    if (isMissingListingImagesTableError(existingImagesResult.error)) {
      return;
    }
    throw existingImagesResult.error;
  }

  const existingStoragePaths = new Set((existingImagesResult.data ?? []).map((item) => item.storage_path));
  const nextStoragePaths = new Set(input.images.map((item) => item.storagePath));
  const removedStoragePaths = Array.from(existingStoragePaths).filter((path) => !nextStoragePaths.has(path));

  const deleteRowsResult = await client.from("listing_images").delete().eq("listing_id", input.listingId).eq("user_id", input.ownerId);
  if (deleteRowsResult.error) {
    if (isMissingListingImagesTableError(deleteRowsResult.error)) {
      return;
    }
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
      if (isMissingListingImagesTableError(insertImagesResult.error)) {
        return;
      }
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

        if (normalizedQuery.filters?.category) {
          supabaseQuery = supabaseQuery.eq("category_slug", normalizedQuery.filters.category);
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
    async getCommissionSettings() {
      const { data, error } = await client
        .from("marketplace_commission_settings")
        .select("commission_rate_percent,updated_at")
        .eq("id", true)
        .maybeSingle();

      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error("Marketplace commission settings are not configured.");
      }

      const row = data as CommissionSettingsRow;
      return {
        commissionRatePercent: Number(row.commission_rate_percent ?? 0),
        updatedAt: row.updated_at
      };
    },
    async listSalePaymentsBySeller(sellerId) {
      const { data, error } = await client
        .from("listing_sale_payments")
        .select(SALE_PAYMENT_SELECT)
        .eq("seller_id", sellerId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      return ((data ?? []) as SalePaymentRow[]).map((row) => mapSalePaymentRow(row));
    },
    async prepareSalePayment(input) {
      const { data, error } = await client.rpc("prepare_listing_sale_payment", {
        p_listing_id: input.listingId,
        p_final_sale_amount: input.finalSaleAmount,
        p_sale_source: input.saleSource,
        p_sale_source_other: input.saleSourceOther ?? null,
        p_buyer_name: input.buyerName ?? null,
        p_buyer_phone: input.buyerPhone ?? null
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? (data[0] as SalePaymentRow | undefined) : (data as SalePaymentRow | null);
      if (!row) {
        throw new Error("Could not prepare the commission payment.");
      }
      if (row.seller_id !== input.sellerId) {
        throw new Error("Commission payment ownership mismatch.");
      }

      return mapSalePaymentRow(row);
    },
    async finalizeSalePayment(input) {
      const { data, error } = await client.rpc("finalize_listing_sale_payment", {
        p_listing_id: input.listingId,
        p_payment_status: input.outcome,
        p_payment_method: input.paymentMethod ?? null,
        p_failure_reason: input.failureReason ?? null
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? (data[0] as SalePaymentRow | undefined) : (data as SalePaymentRow | null);
      if (!row) {
        throw new Error("Could not finalize the commission payment.");
      }
      if (row.seller_id !== input.sellerId) {
        throw new Error("Commission payment ownership mismatch.");
      }

      return mapSalePaymentRow(row);
    },
    async getSaleInvoice(listingId, sellerId) {
      const { data, error } = await client
        .from("listing_sale_payments")
        .select(
          `${SALE_PAYMENT_SELECT},listing:listings!listing_sale_payments_listing_id_fkey(id,title,image_url),seller:profiles!listing_sale_payments_seller_id_fkey(display_name,username)`
        )
        .eq("listing_id", listingId)
        .eq("seller_id", sellerId)
        .maybeSingle();

      if (error) {
        throw error;
      }
      if (!data) {
        return null;
      }

      const row = data as unknown as SaleInvoiceRow;
      const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
      return {
        payment: mapSalePaymentRow(row),
        listingId: row.listing?.id ?? listingId,
        listingTitle: row.listing?.title?.trim() || listingId,
        listingImageUrl: row.listing?.image_url ?? null,
        sellerDisplayName: seller?.display_name?.trim() || seller?.username || sellerId,
        sellerUsername: seller?.username ?? null
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
