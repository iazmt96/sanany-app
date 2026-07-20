-- Fix: Ensure car-listings storage bucket exists with correct settings
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'car-listings',
  'car-listings',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop existing policies to recreate cleanly
drop policy if exists "car_listings_storage_select_public" on storage.objects;
drop policy if exists "car_listings_storage_select_owner" on storage.objects;
drop policy if exists "car_listings_storage_insert_owner" on storage.objects;
drop policy if exists "car_listings_storage_update_owner" on storage.objects;
drop policy if exists "car_listings_storage_delete_owner" on storage.objects;

-- Public read (bucket is public)
create policy "car_listings_storage_select_public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'car-listings');

-- Authenticated: INSERT
create policy "car_listings_storage_insert_owner"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'car-listings'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

-- Authenticated: UPDATE (required for upsert)
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

-- Authenticated: DELETE
create policy "car_listings_storage_delete_owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'car-listings'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
