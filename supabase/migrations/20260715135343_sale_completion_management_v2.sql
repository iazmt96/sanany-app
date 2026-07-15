alter table public.listing_sale_payments
  add column if not exists sale_source text not null default 'outside_sanany'
    check (sale_source in ('sanany_chat', 'outside_sanany', 'cancelled', 'other')),
  add column if not exists sale_source_other text,
  add column if not exists buyer_name text,
  add column if not exists buyer_phone text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_review_status text not null default 'not_requested'
    check (refund_review_status in ('not_requested', 'requested', 'approved', 'rejected'));

alter table public.listing_sale_payments
  drop constraint if exists listing_sale_payments_sale_source_other_check;

alter table public.listing_sale_payments
  add constraint listing_sale_payments_sale_source_other_check
  check (
    (sale_source = 'other' and sale_source_other is not null and length(trim(sale_source_other)) > 0)
    or sale_source <> 'other'
  );

create index if not exists listing_sale_payments_sale_source_idx
  on public.listing_sale_payments (sale_source, updated_at desc);

create or replace function public.prepare_listing_sale_payment(
  p_listing_id uuid,
  p_final_sale_amount numeric,
  p_sale_source text,
  p_sale_source_other text default null,
  p_buyer_name text default null,
  p_buyer_phone text default null
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
  normalized_sale_source text;
  normalized_sale_source_other text;
  normalized_buyer_name text;
  normalized_buyer_phone text;
begin
  if p_final_sale_amount is null or p_final_sale_amount <= 0 then
    raise exception 'Final sale amount must be greater than zero.';
  end if;

  normalized_sale_source := coalesce(nullif(trim(coalesce(p_sale_source, '')), ''), 'outside_sanany');
  if normalized_sale_source not in ('sanany_chat', 'outside_sanany', 'cancelled', 'other') then
    raise exception 'Unsupported sale source.';
  end if;

  normalized_sale_source_other := nullif(trim(coalesce(p_sale_source_other, '')), '');
  if normalized_sale_source = 'other' and normalized_sale_source_other is null then
    raise exception 'Sale source note is required when source is other.';
  end if;

  normalized_buyer_name := nullif(trim(coalesce(p_buyer_name, '')), '');
  normalized_buyer_phone := nullif(trim(coalesce(p_buyer_phone, '')), '');

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
    sale_source,
    sale_source_other,
    final_sale_amount,
    commission_rate_percent,
    commission_amount,
    buyer_name,
    buyer_phone,
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
    normalized_sale_source,
    normalized_sale_source_other,
    round(p_final_sale_amount::numeric, 2),
    commission_rate,
    commission_amount,
    normalized_buyer_name,
    normalized_buyer_phone,
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
    sale_source = excluded.sale_source,
    sale_source_other = excluded.sale_source_other,
    final_sale_amount = excluded.final_sale_amount,
    commission_rate_percent = excluded.commission_rate_percent,
    commission_amount = excluded.commission_amount,
    buyer_name = excluded.buyer_name,
    buyer_phone = excluded.buyer_phone,
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

grant execute on function public.prepare_listing_sale_payment(uuid, numeric, text, text, text, text) to authenticated;