create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  width integer,
  height integer,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_images_listing_id_idx on public.listing_images (listing_id);
create index if not exists listing_images_listing_id_sort_order_idx on public.listing_images (listing_id, sort_order);
create unique index if not exists listing_images_primary_per_listing_uidx on public.listing_images (listing_id) where is_primary;

alter table public.listing_images enable row level security;

create policy "listing_images_select_owner_or_public_listing"
  on public.listing_images
  for select
  to authenticated, anon
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.status in ('available', 'reserved')
    )
  );

create policy "listing_images_insert_owner"
  on public.listing_images
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy "listing_images_update_owner"
  on public.listing_images
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy "listing_images_delete_owner"
  on public.listing_images
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.owner_id = (select auth.uid())
    )
  );

drop trigger if exists listing_images_updated_at on public.listing_images;
create trigger listing_images_updated_at
  before update on public.listing_images
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'car-listings',
  'car-listings',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "car_listings_storage_insert_owner"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'car-listings'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "car_listings_storage_update_owner"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'car-listings'
    and split_part(name, '/', 1) = (select auth.uid())::text
  )
  with check (
    bucket_id = 'car-listings'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "car_listings_storage_delete_owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'car-listings'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
