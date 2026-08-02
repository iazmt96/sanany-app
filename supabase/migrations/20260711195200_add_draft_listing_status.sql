alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('draft', 'available', 'reserved', 'inactive'));

drop policy if exists "listings_read_public" on public.listings;
create policy "listings_read_public"
  on public.listings
  for select
  using (
    status in ('available', 'reserved')
    or (
      (select auth.uid()) is not null
      and owner_id = (select auth.uid())
    )
  );

drop policy if exists "listings_update_owner" on public.listings;
create policy "listings_update_owner"
  on public.listings
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
