import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import type { ListingStatus } from "@sanany/types";
import { readMetadataPhone } from "@sanany/shared";
import { createClient } from "../../../utils/supabase/server";

type CreateListingBody = {
  draftId?: string;
  status?: ListingStatus;
  title?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
};

function isMissingListingsColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";
  const isPostgresMissingColumn = error.code === "42703" && message.includes("column listings.");
  const isPostgrestSchemaCacheMissingColumn =
    message.includes("column of 'listings'") && message.toLowerCase().includes("schema cache");
  return isPostgresMissingColumn || isPostgrestSchemaCacheMissingColumn;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase server configuration is missing." }, { status: 500 });
  }

  let body: CreateListingBody;
  try {
    body = (await request.json()) as CreateListingBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = body.title?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  const price = Number(body.price);
  const status = body.status === "draft" ? "draft" : "available";
  const draftId = body.draftId?.trim() || null;
  const imageUrl = body.imageUrl?.trim() ?? null;
  const locationName = body.locationName?.trim() ?? null;
  const latitude = typeof body.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null;
  const longitude = typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null;

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (status === "available" && (!Number.isFinite(price) || price <= 0)) {
    return NextResponse.json({ error: "Price must be greater than zero." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient(url, serviceKey, { auth: { persistSession: false } });
  const ownerPhone =
    (user.phone && user.phone.trim().length > 0 ? user.phone.trim() : null) ??
    readMetadataPhone(user.user_metadata);
  const payload = {
    title,
    description: description || null,
    price: Number.isFinite(price) && price > 0 ? price : 1,
    status,
    image_url: imageUrl,
    location_name: locationName,
    latitude,
    longitude,
    owner_phone: ownerPhone,
    owner_id: user.id
  };

  const query = draftId
    ? adminClient
        .from("listings")
        .update(payload)
        .eq("id", draftId)
        .eq("owner_id", user.id)
    : adminClient.from("listings").insert(payload);

  let { data, error } = await query
    .select("id,owner_id,owner_phone,title,description,price,status,image_url,location_name,latitude,longitude,created_at")
    .single();

  if (isMissingListingsColumnError(error)) {
    const legacyPayload = {
      title,
      description: description || null,
      price: Number.isFinite(price) && price > 0 ? price : 1,
      status,
      image_url: imageUrl,
      owner_id: user.id
    };

    const legacyQuery = draftId
      ? adminClient
          .from("listings")
          .update(legacyPayload)
          .eq("id", draftId)
          .eq("owner_id", user.id)
      : adminClient.from("listings").insert(legacyPayload);

    ({ data, error } = await legacyQuery
      .select("id,owner_id,title,description,price,status,image_url,created_at")
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, listing: data });
}
