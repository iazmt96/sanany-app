import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// One-time database setup: creates listings table + seed data.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
// Usage: GET http://localhost:3001/api/admin/setup
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local",
        instructions:
          "Go to: Supabase Dashboard → Project Settings → API → service_role (secret key) → copy → add to apps/web/.env.local"
      },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: tableCheckError } = await admin.from("listings").select("id", { count: "exact", head: true }).limit(1);
  if (tableCheckError) {
    return NextResponse.json(
      {
        error: "Listings table is missing.",
        detail: tableCheckError.message,
        instructions:
          "Run supabase/migrations/20240101000000_create_listings.sql in Supabase SQL Editor first, then call /api/admin/setup again."
      },
      { status: 500 }
    );
  }

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (usersError) {
    return NextResponse.json({ error: "Failed to load auth users", detail: usersError.message }, { status: 500 });
  }

  const seedOwner = usersData.users[0];
  if (!seedOwner) {
    return NextResponse.json(
      {
        error: "No auth users available for seed ownership.",
        instructions: "Create at least one user account first, then call /api/admin/setup again."
      },
      { status: 400 }
    );
  }

  const metadata = seedOwner.user_metadata && typeof seedOwner.user_metadata === "object" ? (seedOwner.user_metadata as Record<string, unknown>) : {};
  const ownerPhoneCandidate = [seedOwner.phone, metadata.phone, metadata.phone_number, metadata.mobile].find(
    (value) => typeof value === "string" && value.trim().length > 0
  );
  const seedOwnerPhone = typeof ownerPhoneCandidate === "string" ? ownerPhoneCandidate.trim() : null;

  // Seed demo listings
  const seeds = [
    { title: "خدمة تنظيف المنازل", description: "تنظيف شامل للمنازل والشقق بأفضل المعدات", price: 150, status: "available" },
    { title: "نقل أثاث", description: "خدمة نقل الأثاث مع الفك والتركيب", price: 300, status: "available" },
    { title: "تركيب مكيفات", description: "تركيب وصيانة المكيفات بضمان سنة", price: 200, status: "reserved" },
    { title: "خدمة سباكة", description: "إصلاح وصيانة السباكة 24/7", price: 100, status: "available" },
    { title: "كهرباء منزلية", description: "خدمات كهربائية موثوقة وسريعة", price: 120, status: "available" },
    { title: "دهانات ديكور", description: "دهانات داخلية وخارجية بأجود الأصباغ", price: 80, status: "available" }
  ].map((seed) => ({
    ...seed,
    owner_id: seedOwner.id,
    owner_phone: seedOwnerPhone
  }));

  const { count, error: countError } = await admin.from("listings").select("id", { count: "exact", head: true });
  if (countError) {
    return NextResponse.json({ error: "Count failed", detail: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, message: "Listings already seeded." });
  }

  const { error: seedError } = await admin.from("listings").insert(seeds);
  if (seedError) {
    return NextResponse.json({ error: "Seed failed", detail: seedError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Listings seed completed." });
}
