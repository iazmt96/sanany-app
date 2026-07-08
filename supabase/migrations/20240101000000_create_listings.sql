-- SANANY Marketplace: listings table
-- Run this in Supabase SQL Editor or via `supabase db push`

create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  price       numeric(12, 2) not null default 0,
  status      text not null default 'available'
               check (status in ('available', 'reserved', 'inactive')),
  owner_id    uuid references auth.users(id) on delete cascade,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for common query patterns
create index if not exists listings_status_idx  on public.listings (status);
create index if not exists listings_owner_idx   on public.listings (owner_id);
create index if not exists listings_created_idx on public.listings (created_at desc);

-- Row Level Security
alter table public.listings enable row level security;

-- Public can read available/reserved listings
create policy "listings_read_public" on public.listings
  for select using (status in ('available', 'reserved'));

-- Authenticated owners can insert
create policy "listings_insert_owner" on public.listings
  for insert with check (auth.uid() = owner_id);

-- Owners can update/delete their own listings
create policy "listings_update_owner" on public.listings
  for update using (auth.uid() = owner_id);

create policy "listings_delete_owner" on public.listings
  for delete using (auth.uid() = owner_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- Seed demo listings
insert into public.listings (title, description, price, status) values
  ('خدمة تنظيف المنازل', 'تنظيف شامل للمنازل والشقق بأفضل المعدات', 150.00, 'available'),
  ('نقل أثاث', 'خدمة نقل الأثاث مع الفك والتركيب', 300.00, 'available'),
  ('تركيب مكيفات', 'تركيب وصيانة المكيفات بضمان سنة', 200.00, 'reserved'),
  ('خدمة سباكة', 'إصلاح وصيانة السباكة 24/7', 100.00, 'available'),
  ('كهرباء منزلية', 'خدمات كهربائية موثوقة وسريعة', 120.00, 'available'),
  ('دهانات ديكور', 'دهانات داخلية وخارجية بأجود الأصباغ', 80.00, 'available');
