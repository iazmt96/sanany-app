alter table public.listings
  add column if not exists owner_phone text;

update public.listings as l
set owner_phone = source.owner_phone
from (
  select
    id,
    nullif(
      coalesce(
        phone,
        nullif(raw_user_meta_data ->> 'phone', ''),
        nullif(raw_user_meta_data ->> 'phone_number', ''),
        nullif(raw_user_meta_data ->> 'mobile', '')
      ),
      ''
    ) as owner_phone
  from auth.users
) as source
where l.owner_id = source.id
  and (l.owner_phone is null or btrim(l.owner_phone) = '');

delete from public.listings
where owner_id is null;

alter table public.listings
  alter column owner_id set not null;
