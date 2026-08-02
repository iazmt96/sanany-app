create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  city text,
  account_type text not null default 'individual' check (account_type in ('individual', 'dealer', 'business', 'store')),
  is_verified boolean not null default false,
  show_last_seen boolean not null default true,
  show_phone boolean not null default false,
  phone text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> rater_id)
);

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);
create index if not exists ratings_seller_idx on public.ratings (seller_id, created_at desc);
create index if not exists ratings_listing_idx on public.ratings (listing_id);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists ratings_updated_at on public.ratings;
create trigger ratings_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.ratings enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
  on public.profiles
  for select
  using (true);

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "follows_public_read" on public.follows;
create policy "follows_public_read"
  on public.follows
  for select
  using (true);

drop policy if exists "follows_owner_insert" on public.follows;
create policy "follows_owner_insert"
  on public.follows
  for insert
  to authenticated
  with check ((select auth.uid()) = follower_id and follower_id <> following_id);

drop policy if exists "follows_owner_delete" on public.follows;
create policy "follows_owner_delete"
  on public.follows
  for delete
  to authenticated
  using ((select auth.uid()) = follower_id);

drop policy if exists "ratings_public_read" on public.ratings;
create policy "ratings_public_read"
  on public.ratings
  for select
  using (true);

drop policy if exists "ratings_authenticated_insert" on public.ratings;
create policy "ratings_authenticated_insert"
  on public.ratings
  for insert
  to authenticated
  with check ((select auth.uid()) = rater_id and rater_id <> seller_id);

drop policy if exists "ratings_owner_update" on public.ratings;
create policy "ratings_owner_update"
  on public.ratings
  for update
  to authenticated
  using ((select auth.uid()) = rater_id)
  with check ((select auth.uid()) = rater_id);

drop policy if exists "ratings_owner_delete" on public.ratings;
create policy "ratings_owner_delete"
  on public.ratings
  for delete
  to authenticated
  using ((select auth.uid()) = rater_id);

insert into public.profiles (id, username, display_name, avatar_url, bio, city, account_type, is_verified, show_last_seen, show_phone, phone, joined_at, last_seen_at)
select
  u.id,
  nullif(lower(regexp_replace(split_part(coalesce(u.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')), ''),
  nullif(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', split_part(coalesce(u.email, ''), '@', 1)), ''),
  nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
  nullif(u.raw_user_meta_data ->> 'bio', ''),
  nullif(u.raw_user_meta_data ->> 'city', ''),
  case
    when (u.raw_user_meta_data ->> 'account_type') in ('individual', 'dealer', 'business', 'store') then (u.raw_user_meta_data ->> 'account_type')
    else 'individual'
  end,
  false,
  true,
  false,
  nullif(coalesce(u.phone, u.raw_user_meta_data ->> 'phone', u.raw_user_meta_data ->> 'phone_number'), ''),
  coalesce(u.created_at, now()),
  u.last_sign_in_at
from auth.users u
on conflict (id) do update
set
  username = excluded.username,
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
  bio = coalesce(public.profiles.bio, excluded.bio),
  city = coalesce(public.profiles.city, excluded.city),
  phone = coalesce(public.profiles.phone, excluded.phone),
  last_seen_at = excluded.last_seen_at;

create or replace view public.seller_profile_stats
with (security_invoker = true) as
select
  p.id as seller_id,
  coalesce((select count(*) from public.listings l where l.owner_id = p.id and l.status in ('available', 'reserved', 'inactive')), 0)::int as listings_count,
  coalesce((select count(*) from public.listings l where l.owner_id = p.id and l.status in ('reserved', 'inactive')), 0)::int as sold_listings_count,
  coalesce((select count(*) from public.follows f where f.following_id = p.id), 0)::int as followers_count,
  coalesce((select count(*) from public.follows f where f.follower_id = p.id), 0)::int as following_count,
  coalesce((select count(*) from public.ratings r where r.seller_id = p.id), 0)::int as rating_count,
  coalesce((select avg(r.rating)::numeric(10,2) from public.ratings r where r.seller_id = p.id), 0)::numeric(10,2) as rating_average
from public.profiles p;

create or replace view public.ratings_with_profiles
with (security_invoker = true) as
select
  r.id,
  r.seller_id,
  r.rater_id,
  r.listing_id,
  r.rating,
  r.comment,
  r.created_at,
  coalesce(p.display_name, p.username) as rater_name,
  p.avatar_url as rater_avatar_url
from public.ratings r
left join public.profiles p on p.id = r.rater_id;

grant select on public.seller_profile_stats to anon, authenticated;
grant select on public.ratings_with_profiles to anon, authenticated;
