create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  audience text not null check (audience in ('all', 'individual', 'company', 'user')),
  audience_user_id uuid references auth.users(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  check (
    (audience = 'user' and audience_user_id is not null)
    or (audience <> 'user' and audience_user_id is null)
  )
);

create table if not exists public.admin_notification_deliveries (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists admin_notifications_created_at_idx on public.admin_notifications (created_at desc);
create index if not exists admin_notifications_audience_idx on public.admin_notifications (audience, created_at desc);
create index if not exists admin_notification_deliveries_user_idx on public.admin_notification_deliveries (user_id, created_at desc);
create index if not exists admin_notification_deliveries_read_idx on public.admin_notification_deliveries (user_id, read_at);

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_deliveries enable row level security;

drop policy if exists "admin_notifications_recipient_select" on public.admin_notifications;
create policy "admin_notifications_recipient_select"
  on public.admin_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_notification_deliveries d
      where d.notification_id = id
        and d.user_id = (select auth.uid())
    )
  );

drop policy if exists "admin_notification_deliveries_owner_select" on public.admin_notification_deliveries;
create policy "admin_notification_deliveries_owner_select"
  on public.admin_notification_deliveries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "admin_notification_deliveries_owner_update" on public.admin_notification_deliveries;
create policy "admin_notification_deliveries_owner_update"
  on public.admin_notification_deliveries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
