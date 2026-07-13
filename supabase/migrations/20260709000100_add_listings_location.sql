alter table public.listings
  add column if not exists location_name text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

update public.listings
set
  location_name = coalesce(location_name, 'الرياض'),
  latitude = coalesce(latitude, 24.7136 + ((random() - 0.5) * 0.12)),
  longitude = coalesce(longitude, 46.6753 + ((random() - 0.5) * 0.12))
where location_name is null or latitude is null or longitude is null;

