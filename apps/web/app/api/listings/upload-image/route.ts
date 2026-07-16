import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { LISTING_IMAGES_BUCKET } from "@sanany/shared";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Verify the user is authenticated
  const cookieStore = await cookies();
  const userClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {}
    }
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const storagePath = formData.get("storagePath") as string | null;

  if (!file || !storagePath) {
    return NextResponse.json({ error: "Missing file or storagePath" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  // Enforce that the path starts with the user's own ID
  const pathOwner = storagePath.split("/")[0];
  if (pathOwner !== user.id) {
    return NextResponse.json({ error: "Forbidden: path owner mismatch" }, { status: 403 });
  }

  // Upload using service role key (bypasses storage RLS)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(LISTING_IMAGES_BUCKET)
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600"
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from(LISTING_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  return NextResponse.json({ publicUrl, storagePath });
}
