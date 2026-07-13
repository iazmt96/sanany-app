-- Fix listings INSERT RLS policy to use recommended pattern
-- The old policy used auth.uid() directly; this uses (select auth.uid())
-- which is more reliable and avoids potential evaluation issues.

drop policy if exists "listings_insert_owner" on public.listings;

create policy "listings_insert_owner"
  on public.listings
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and status in ('draft', 'available', 'reserved', 'inactive')
  );
