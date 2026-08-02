update public.profiles
set username = nullif(lower(regexp_replace(username, '[^a-zA-Z0-9._]', '', 'g')), '')
where username is not null;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.normalize_profile_username()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.username is not null then
    new.username := nullif(lower(regexp_replace(new.username, '[^a-zA-Z0-9._]', '', 'g')), '');
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username
  before insert or update of username on public.profiles
  for each row execute function public.normalize_profile_username();

create table if not exists public.account_private_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date,
  gender text check (gender in ('male', 'female', 'prefer_not_to_say')),
  preferred_contact_method text check (preferred_contact_method in ('phone', 'chat', 'whatsapp', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists account_private_profiles_updated_at on public.account_private_profiles;
create trigger account_private_profiles_updated_at
  before update on public.account_private_profiles
  for each row execute function public.set_updated_at();

alter table public.account_private_profiles enable row level security;
revoke all on public.account_private_profiles from anon;
grant select, insert, update on public.account_private_profiles to authenticated;

drop policy if exists "account_private_profiles_owner_read" on public.account_private_profiles;
create policy "account_private_profiles_owner_read"
  on public.account_private_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "account_private_profiles_owner_insert" on public.account_private_profiles;
create policy "account_private_profiles_owner_insert"
  on public.account_private_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "account_private_profiles_owner_update" on public.account_private_profiles;
create policy "account_private_profiles_owner_update"
  on public.account_private_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.account_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'unverified' check (status in ('unverified', 'pending', 'additional_info_required', 'verified', 'rejected')),
  legal_full_name text,
  national_id text,
  birth_date date,
  city text,
  email text,
  document_front_url text,
  document_back_url text,
  selfie_url text,
  business_name text,
  business_registration text,
  additional_documents text[] not null default '{}',
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_verification_requests_status_idx on public.account_verification_requests (status, updated_at desc);

drop trigger if exists account_verification_requests_updated_at on public.account_verification_requests;
create trigger account_verification_requests_updated_at
  before update on public.account_verification_requests
  for each row execute function public.set_updated_at();

alter table public.account_verification_requests enable row level security;
revoke all on public.account_verification_requests from anon;
grant select, insert, update on public.account_verification_requests to authenticated;

drop policy if exists "account_verification_requests_owner_read" on public.account_verification_requests;
create policy "account_verification_requests_owner_read"
  on public.account_verification_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "account_verification_requests_owner_insert" on public.account_verification_requests;
create policy "account_verification_requests_owner_insert"
  on public.account_verification_requests
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and status in ('unverified', 'pending', 'additional_info_required'));

drop policy if exists "account_verification_requests_owner_update" on public.account_verification_requests;
create policy "account_verification_requests_owner_update"
  on public.account_verification_requests
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.block_client_account_verification_status_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and old.user_id = (select auth.uid())
     and new.status is distinct from old.status
     and not (
       old.status in ('unverified', 'additional_info_required')
       and new.status in ('unverified', 'pending', 'additional_info_required')
     ) then
    raise exception 'Changing verification status is not allowed for client updates';
  end if;

  return new;
end;
$$;

drop trigger if exists account_verification_requests_block_status_change on public.account_verification_requests;
create trigger account_verification_requests_block_status_change
  before update on public.account_verification_requests
  for each row execute function public.block_client_account_verification_status_change();

insert into public.account_private_profiles (user_id)
select id
from public.profiles
on conflict (user_id) do nothing;