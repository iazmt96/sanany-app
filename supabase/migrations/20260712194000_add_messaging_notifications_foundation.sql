create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  blocked_by uuid references auth.users(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id, seller_id),
  check (buyer_id <> seller_id),
  check (blocked_by is null or blocked_by in (buyer_id, seller_id)),
  check (reported_by is null or reported_by in (buyer_id, seller_id))
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  image_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    coalesce(length(trim(body)), 0) > 0
    or coalesce(length(trim(image_url)), 0) > 0
  )
);

create table if not exists public.listing_status_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  old_status text not null,
  new_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('message', 'follow', 'rating', 'listing_status')),
  reference_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, kind, reference_id)
);

create index if not exists conversations_participants_idx on public.conversations (buyer_id, seller_id, last_message_at desc);
create index if not exists conversations_listing_idx on public.conversations (listing_id);
create index if not exists conversation_messages_conversation_idx on public.conversation_messages (conversation_id, created_at desc);
create index if not exists conversation_messages_unread_idx on public.conversation_messages (conversation_id, read_at) where read_at is null;
create index if not exists listing_status_events_owner_idx on public.listing_status_events (owner_id, created_at desc);
create index if not exists notification_reads_user_idx on public.notification_reads (user_id, read_at desc);

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create or replace function public.sync_conversation_last_message()
returns trigger
language plpgsql
as $$
declare
  preview text;
begin
  preview := case
    when coalesce(length(trim(new.body)), 0) > 0 then trim(new.body)
    when coalesce(length(trim(new.image_url)), 0) > 0 then '[image]'
    else null
  end;

  update public.conversations
  set
    last_message_preview = preview,
    last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists conversation_messages_sync_conversation on public.conversation_messages;
create trigger conversation_messages_sync_conversation
  after insert on public.conversation_messages
  for each row execute function public.sync_conversation_last_message();

create or replace function public.track_listing_status_event()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    insert into public.listing_status_events (listing_id, owner_id, old_status, new_status)
    values (new.id, new.owner_id, old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists listings_track_status_event on public.listings;
create trigger listings_track_status_event
  after update on public.listings
  for each row execute function public.track_listing_status_event();

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.listing_status_events enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists "conversations_participants_select" on public.conversations;
create policy "conversations_participants_select"
  on public.conversations
  for select
  to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

drop policy if exists "conversations_buyer_insert" on public.conversations;
create policy "conversations_buyer_insert"
  on public.conversations
  for insert
  to authenticated
  with check (
    (select auth.uid()) = buyer_id
    and buyer_id <> seller_id
    and seller_id = (select l.owner_id from public.listings l where l.id = listing_id)
  );

drop policy if exists "conversations_participants_update" on public.conversations;
create policy "conversations_participants_update"
  on public.conversations
  for update
  to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id))
  with check (
    (select auth.uid()) in (buyer_id, seller_id)
    and (blocked_by is null or blocked_by = (select auth.uid()))
    and (reported_by is null or reported_by = (select auth.uid()))
  );

drop policy if exists "conversation_messages_participants_select" on public.conversation_messages;
create policy "conversation_messages_participants_select"
  on public.conversation_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  );

drop policy if exists "conversation_messages_participants_insert" on public.conversation_messages;
create policy "conversation_messages_participants_insert"
  on public.conversation_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
        and c.blocked_by is null
    )
  );

drop policy if exists "conversation_messages_recipient_update" on public.conversation_messages;
create policy "conversation_messages_recipient_update"
  on public.conversation_messages
  for update
  to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and read_at is not null
  );

drop policy if exists "listing_status_events_owner_select" on public.listing_status_events;
create policy "listing_status_events_owner_select"
  on public.listing_status_events
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "listing_status_events_owner_insert" on public.listing_status_events;
create policy "listing_status_events_owner_insert"
  on public.listing_status_events
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "notification_reads_owner_select" on public.notification_reads;
create policy "notification_reads_owner_select"
  on public.notification_reads
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "notification_reads_owner_insert" on public.notification_reads;
create policy "notification_reads_owner_insert"
  on public.notification_reads
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "notification_reads_owner_update" on public.notification_reads;
create policy "notification_reads_owner_update"
  on public.notification_reads
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
