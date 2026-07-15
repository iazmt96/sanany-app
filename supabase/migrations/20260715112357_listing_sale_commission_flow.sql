alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('draft', 'available', 'reserved', 'sold', 'inactive'));

drop policy if exists "listings_read_public" on public.listings;
create policy "listings_read_public"
  on public.listings
  for select
  using (
    status in ('available', 'reserved', 'sold')
    or (
      (select auth.uid()) is not null
      and owner_id = (select auth.uid())
    )
  );

create table if not exists public.marketplace_commission_settings (
  id boolean primary key default true check (id),
  commission_rate_percent numeric(5, 2) not null default 1 check (commission_rate_percent > 0 and commission_rate_percent <= 100),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketplace_commission_settings (id, commission_rate_percent)
values (true, 1)
on conflict (id) do nothing;

drop trigger if exists marketplace_commission_settings_updated_at on public.marketplace_commission_settings;
create trigger marketplace_commission_settings_updated_at
  before update on public.marketplace_commission_settings
  for each row execute function public.set_updated_at();

alter table public.marketplace_commission_settings enable row level security;

drop policy if exists "marketplace_commission_settings_select_authenticated" on public.marketplace_commission_settings;
create policy "marketplace_commission_settings_select_authenticated"
  on public.marketplace_commission_settings
  for select
  to authenticated
  using (true);

create table if not exists public.listing_sale_payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  final_sale_amount numeric(12, 2) not null check (final_sale_amount > 0),
  commission_rate_percent numeric(5, 2) not null check (commission_rate_percent > 0 and commission_rate_percent <= 100),
  commission_amount numeric(12, 2) not null check (commission_amount >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_method text,
  payment_date timestamptz,
  invoice_number text unique,
  transaction_reference text,
  failure_reason text,
  refund_reason text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    payment_status <> 'paid'
    or (payment_date is not null and invoice_number is not null and transaction_reference is not null)
  ),
  check (
    payment_status <> 'refunded'
    or refunded_at is not null
  )
);

create index if not exists listing_sale_payments_seller_idx
  on public.listing_sale_payments (seller_id, updated_at desc);

create index if not exists listing_sale_payments_status_idx
  on public.listing_sale_payments (payment_status, payment_date desc nulls last);

drop trigger if exists listing_sale_payments_updated_at on public.listing_sale_payments;
create trigger listing_sale_payments_updated_at
  before update on public.listing_sale_payments
  for each row execute function public.set_updated_at();

alter table public.listing_sale_payments enable row level security;

drop policy if exists "listing_sale_payments_owner_select" on public.listing_sale_payments;
create policy "listing_sale_payments_owner_select"
  on public.listing_sale_payments
  for select
  to authenticated
  using ((select auth.uid()) = seller_id);

drop policy if exists "listing_sale_payments_owner_insert" on public.listing_sale_payments;
create policy "listing_sale_payments_owner_insert"
  on public.listing_sale_payments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = seller_id
    and exists (
      select 1
      from public.listings as listing
      where listing.id = listing_id
        and listing.owner_id = (select auth.uid())
    )
  );

drop policy if exists "listing_sale_payments_owner_update" on public.listing_sale_payments;
create policy "listing_sale_payments_owner_update"
  on public.listing_sale_payments
  for update
  to authenticated
  using ((select auth.uid()) = seller_id)
  with check (
    (select auth.uid()) = seller_id
    and exists (
      select 1
      from public.listings as listing
      where listing.id = listing_id
        and listing.owner_id = (select auth.uid())
    )
  );

grant select on table public.marketplace_commission_settings to authenticated, service_role;
grant select, insert, update on table public.listing_sale_payments to authenticated, service_role;

create or replace function public.get_marketplace_commission_rate()
returns numeric
language plpgsql
security invoker
as $$
declare
  current_rate numeric(5, 2);
begin
  select settings.commission_rate_percent
  into current_rate
  from public.marketplace_commission_settings as settings
  where settings.id = true;

  if current_rate is null then
    raise exception 'Marketplace commission rate is not configured.';
  end if;

  return current_rate;
end;
$$;

grant execute on function public.get_marketplace_commission_rate() to authenticated;

create or replace function public.prepare_listing_sale_payment(
  p_listing_id uuid,
  p_final_sale_amount numeric
)
returns setof public.listing_sale_payments
language plpgsql
security invoker
as $$
declare
  listing_row public.listings%rowtype;
  payment_row public.listing_sale_payments%rowtype;
  existing_payment public.listing_sale_payments%rowtype;
  commission_rate numeric(5, 2);
  commission_amount numeric(12, 2);
begin
  if p_final_sale_amount is null or p_final_sale_amount <= 0 then
    raise exception 'Final sale amount must be greater than zero.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_listing_id::text));

  select *
  into listing_row
  from public.listings
  where id = p_listing_id
    and owner_id = (select auth.uid());

  if listing_row.id is null then
    raise exception 'Listing was not found for the current seller.';
  end if;

  if listing_row.status not in ('available', 'reserved') then
    raise exception 'Only active listings can move to sale completion.';
  end if;

  select *
  into existing_payment
  from public.listing_sale_payments
  where listing_id = p_listing_id;

  if existing_payment.id is not null and existing_payment.payment_status in ('paid', 'refunded') then
    raise exception 'Commission has already been completed for this listing.';
  end if;

  commission_rate := public.get_marketplace_commission_rate();
  commission_amount := round((p_final_sale_amount * commission_rate / 100)::numeric, 2);

  insert into public.listing_sale_payments (
    listing_id,
    seller_id,
    final_sale_amount,
    commission_rate_percent,
    commission_amount,
    payment_status,
    payment_method,
    payment_date,
    invoice_number,
    transaction_reference,
    failure_reason,
    refund_reason,
    refunded_at
  )
  values (
    p_listing_id,
    listing_row.owner_id,
    round(p_final_sale_amount::numeric, 2),
    commission_rate,
    commission_amount,
    'pending',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (listing_id) do update
  set
    final_sale_amount = excluded.final_sale_amount,
    commission_rate_percent = excluded.commission_rate_percent,
    commission_amount = excluded.commission_amount,
    payment_status = 'pending',
    payment_method = null,
    payment_date = null,
    invoice_number = null,
    transaction_reference = null,
    failure_reason = null,
    refund_reason = null,
    refunded_at = null
  returning *
  into payment_row;

  return next payment_row;
end;
$$;

grant execute on function public.prepare_listing_sale_payment(uuid, numeric) to authenticated;

create or replace function public.finalize_listing_sale_payment(
  p_listing_id uuid,
  p_payment_status text,
  p_payment_method text default null,
  p_failure_reason text default null
)
returns setof public.listing_sale_payments
language plpgsql
security invoker
as $$
declare
  listing_row public.listings%rowtype;
  payment_row public.listing_sale_payments%rowtype;
  next_invoice_number text;
  next_transaction_reference text;
begin
  if p_payment_status not in ('paid', 'failed', 'cancelled') then
    raise exception 'Unsupported payment outcome.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_listing_id::text));

  select *
  into listing_row
  from public.listings
  where id = p_listing_id
    and owner_id = (select auth.uid());

  if listing_row.id is null then
    raise exception 'Listing was not found for the current seller.';
  end if;

  select *
  into payment_row
  from public.listing_sale_payments
  where listing_id = p_listing_id
    and seller_id = (select auth.uid());

  if payment_row.id is null then
    raise exception 'Prepare the commission payment before confirming it.';
  end if;

  if payment_row.payment_status in ('paid', 'refunded') then
    raise exception 'Commission has already been completed for this listing.';
  end if;

  if p_payment_status = 'paid' then
    next_invoice_number := format(
      'SAN-%s-%s',
      to_char(now(), 'YYYYMMDDHH24MISS'),
      upper(substr(replace(p_listing_id::text, '-', ''), 1, 6))
    );
    next_transaction_reference := format(
      'TXN-%s-%s',
      to_char(now(), 'YYYYMMDDHH24MISS'),
      upper(substr(replace(payment_row.id::text, '-', ''), 1, 6))
    );

    update public.listing_sale_payments
    set
      payment_status = 'paid',
      payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), 'digital_checkout'),
      payment_date = now(),
      invoice_number = next_invoice_number,
      transaction_reference = next_transaction_reference,
      failure_reason = null,
      refund_reason = null,
      refunded_at = null
    where id = payment_row.id
    returning *
    into payment_row;

    update public.listings
    set status = 'sold'
    where id = p_listing_id
      and owner_id = (select auth.uid());
  else
    update public.listing_sale_payments
    set
      payment_status = p_payment_status,
      payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), payment_method),
      payment_date = null,
      invoice_number = null,
      transaction_reference = null,
      failure_reason = coalesce(nullif(trim(coalesce(p_failure_reason, '')), ''), case when p_payment_status = 'failed' then 'payment_failed' else 'payment_cancelled' end),
      refund_reason = null,
      refunded_at = null
    where id = payment_row.id
    returning *
    into payment_row;
  end if;

  return next payment_row;
end;
$$;

grant execute on function public.finalize_listing_sale_payment(uuid, text, text, text) to authenticated;