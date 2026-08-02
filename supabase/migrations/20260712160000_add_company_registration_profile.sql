alter table public.profiles drop constraint if exists profiles_account_type_check;

update public.profiles
set account_type = 'company'
where account_type in ('dealer', 'business', 'store');

update public.profiles
set account_type = 'individual'
where account_type is null or account_type not in ('individual', 'company');

alter table public.profiles
  alter column account_type set default 'individual',
  alter column account_type set not null;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('individual', 'company'));

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null,
  representative_name text not null,
  business_type text not null,
  custom_business_type text,
  commercial_registration text not null,
  tax_number text,
  website text,
  description text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (commercial_registration ~ '^[0-9]{8,20}$'),
  check (tax_number is null or tax_number ~ '^[0-9]{8,20}$')
);

create index if not exists company_profiles_user_id_idx on public.company_profiles (user_id);
create index if not exists company_profiles_verification_status_idx on public.company_profiles (verification_status);

drop trigger if exists company_profiles_updated_at on public.company_profiles;
create trigger company_profiles_updated_at
  before update on public.company_profiles
  for each row execute function public.set_updated_at();

alter table public.company_profiles enable row level security;
revoke all on public.company_profiles from anon;
grant select, insert, update, delete on public.company_profiles to authenticated;

drop policy if exists "company_profiles_owner_read" on public.company_profiles;
create policy "company_profiles_owner_read"
  on public.company_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "company_profiles_owner_insert" on public.company_profiles;
create policy "company_profiles_owner_insert"
  on public.company_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "company_profiles_owner_update" on public.company_profiles;
create policy "company_profiles_owner_update"
  on public.company_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "company_profiles_owner_delete" on public.company_profiles;
create policy "company_profiles_owner_delete"
  on public.company_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

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
      coalesce(nullif(metadata ->> 'company_name', ''), coalesce(derived_display_name, 'Company')),
      coalesce(nullif(metadata ->> 'representative_name', ''), coalesce(derived_display_name, 'Representative')),
      coalesce(nullif(metadata ->> 'business_type', ''), 'other'),
      nullif(metadata ->> 'custom_business_type', ''),
      coalesce(nullif(metadata ->> 'commercial_registration', ''), '00000000'),
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

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
select
  p.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'company_name', ''), coalesce(p.display_name, split_part(coalesce(u.email, ''), '@', 1), 'Company')),
  coalesce(nullif(u.raw_user_meta_data ->> 'representative_name', ''), coalesce(p.display_name, 'Representative')),
  coalesce(nullif(u.raw_user_meta_data ->> 'business_type', ''), 'other'),
  nullif(u.raw_user_meta_data ->> 'custom_business_type', ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'commercial_registration', ''),
    '00000000'
  ),
  nullif(u.raw_user_meta_data ->> 'tax_number', ''),
  nullif(u.raw_user_meta_data ->> 'website', ''),
  nullif(u.raw_user_meta_data ->> 'company_description', ''),
  case
    when (u.raw_user_meta_data ->> 'verification_status') in ('unverified', 'pending', 'verified', 'rejected') then (u.raw_user_meta_data ->> 'verification_status')
    else 'unverified'
  end
from public.profiles p
join auth.users u on u.id = p.id
where p.account_type = 'company'
on conflict (user_id) do nothing;
