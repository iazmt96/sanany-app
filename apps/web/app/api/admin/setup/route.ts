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

  // Use pg-meta admin endpoint to execute DDL
  const ddlResponse = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `
        create table if not exists public.listings (
          id         uuid primary key default gen_random_uuid(),
          title      text not null,
          description text,
          price      numeric(12,2) not null default 0,
          status     text not null default 'available'
                       check (status in ('available','reserved','inactive')),
          owner_id   uuid references auth.users(id) on delete cascade,
          image_url  text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        alter table public.listings enable row level security;
        create policy if not exists "read_public" on public.listings
          for select using (status in ('available','reserved'));
      `
    })
  });

  if (!ddlResponse.ok) {
    const body = await ddlResponse.text();
    return NextResponse.json({ error: "DDL failed", detail: body }, { status: 500 });
  }

  // Seed demo listings
  const seeds = [
    { title: "خدمة تنظيف المنازل", description: "تنظيف شامل للمنازل والشقق بأفضل المعدات", price: 150, status: "available" },
    { title: "نقل أثاث", description: "خدمة نقل الأثاث مع الفك والتركيب", price: 300, status: "available" },
    { title: "تركيب مكيفات", description: "تركيب وصيانة المكيفات بضمان سنة", price: 200, status: "reserved" },
    { title: "خدمة سباكة", description: "إصلاح وصيانة السباكة 24/7", price: 100, status: "available" },
    { title: "كهرباء منزلية", description: "خدمات كهربائية موثوقة وسريعة", price: 120, status: "available" },
    { title: "دهانات ديكور", description: "دهانات داخلية وخارجية بأجود الأصباغ", price: 80, status: "available" }
  ];

  const { error: seedError } = await admin.from("listings").upsert(seeds);
  if (seedError) {
    return NextResponse.json({ error: "Seed failed", detail: seedError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "✅ listings table created and seeded with 6 demo listings." });
}
