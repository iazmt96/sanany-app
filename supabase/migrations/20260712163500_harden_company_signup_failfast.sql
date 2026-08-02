do $$
begin
  if to_regclass('public.company_profiles') is null then
    raise exception 'public.company_profiles table is required before running this migration';
  end if;
end;
$$;

update public.company_profiles cp
set commercial_registration = nullif(u.raw_user_meta_data ->> 'commercial_registration', '')
from auth.users u
where cp.user_id = u.id
  and cp.commercial_registration = '00000000'
  and nullif(u.raw_user_meta_data ->> 'commercial_registration', '') is not null;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  normalized_account_type text := case
    when lower(coalesce(metadata ->> 'account_type', 'individual')) = 'company' then 'company'
    else 'individual'
  end;
  normalized_business_type text := nullif(metadata ->> 'business_type', '');
  normalized_company_name text := nullif(metadata ->> 'company_name', '');
  normalized_representative_name text := nullif(metadata ->> 'representative_name', '');
  normalized_commercial_registration text := nullif(metadata ->> 'commercial_registration', '');
  derived_display_name text := nullif(
    coalesce(
      case
        when lower(coalesce(metadata ->> 'account_type', 'individual')) = 'company' then metadata ->> 'company_name'
        else metadata ->> 'display_name'
      end,
      metadata ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    ''
  );
begin
  insert into public.profiles (id, username, display_name, city, phone, account_type, joined_at, last_seen_at)
  values (
    new.id,
    nullif(lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')), ''),
    derived_display_name,
    nullif(metadata ->> 'city', ''),
    nullif(coalesce(new.phone, metadata ->> 'phone'), ''),
    normalized_account_type,
    coalesce(new.created_at, now()),
    new.last_sign_in_at
  )
  on conflict (id) do update
  set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    city = coalesce(public.profiles.city, excluded.city),
    phone = coalesce(public.profiles.phone, excluded.phone),
    account_type = excluded.account_type,
    last_seen_at = excluded.last_seen_at;

  if normalized_account_type = 'company' then
    if normalized_company_name is null then
      raise exception 'Missing required signup metadata: company_name';
    end if;

    if normalized_representative_name is null then
      raise exception 'Missing required signup metadata: representative_name';
    end if;

    if normalized_business_type is null then
      raise exception 'Missing required signup metadata: business_type';
    end if;

    if normalized_commercial_registration is null then
      raise exception 'Missing required signup metadata: commercial_registration';
    end if;

    if normalized_commercial_registration !~ '^[0-9]{8,20}$' then
      raise exception 'Invalid signup metadata: commercial_registration must be 8-20 digits';
    end if;

    insert into public.company_profiles (
      user_id,
      company_name,
      representative_name,
      business_type,
      custom_business_type,
      commercial_registration,
      tax_number,
      website,
      description,
      verification_status
    )
    values (
      new.id,
      normalized_company_name,
      normalized_representative_name,
      normalized_business_type,
      nullif(metadata ->> 'custom_business_type', ''),
      normalized_commercial_registration,
      nullif(metadata ->> 'tax_number', ''),
      nullif(metadata ->> 'website', ''),
      nullif(metadata ->> 'company_description', ''),
      'unverified'
    )
    on conflict (user_id) do update
    set
      company_name = excluded.company_name,
      representative_name = excluded.representative_name,
      business_type = excluded.business_type,
      custom_business_type = excluded.custom_business_type,
      commercial_registration = excluded.commercial_registration,
      tax_number = excluded.tax_number,
      website = excluded.website,
      description = excluded.description;
  end if;

  return new;
end;
$$;
