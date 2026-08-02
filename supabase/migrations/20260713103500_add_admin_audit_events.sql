do $$
begin
  if to_regclass('public.reports') is not null then
    execute $sql$
      create table if not exists public.admin_audit_events (
        id uuid primary key default gen_random_uuid(),
        actor_user_id uuid references auth.users(id) on delete set null,
        event_type text not null check (
          event_type in (
            'admin_announcement_sent',
            'report_status_updated',
            'verification_status_updated',
            'user_role_updated',
            'user_access_updated',
            'review_deleted'
          )
        ),
        target_user_id uuid references auth.users(id) on delete set null,
        target_listing_id uuid references public.listings(id) on delete set null,
        target_report_id uuid references public.reports(id) on delete set null,
        target_review_id uuid references public.ratings(id) on delete set null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    $sql$;
  else
    execute $sql$
      create table if not exists public.admin_audit_events (
        id uuid primary key default gen_random_uuid(),
        actor_user_id uuid references auth.users(id) on delete set null,
        event_type text not null check (
          event_type in (
            'admin_announcement_sent',
            'report_status_updated',
            'verification_status_updated',
            'user_role_updated',
            'user_access_updated',
            'review_deleted'
          )
        ),
        target_user_id uuid references auth.users(id) on delete set null,
        target_listing_id uuid references public.listings(id) on delete set null,
        target_report_id uuid,
        target_review_id uuid references public.ratings(id) on delete set null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    $sql$;
  end if;
end;
$$;

create index if not exists admin_audit_events_created_at_idx on public.admin_audit_events (created_at desc);
create index if not exists admin_audit_events_actor_idx on public.admin_audit_events (actor_user_id, created_at desc);
create index if not exists admin_audit_events_target_user_idx on public.admin_audit_events (target_user_id, created_at desc);

alter table public.admin_audit_events enable row level security;
