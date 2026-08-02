create or replace function public.block_client_account_type_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and old.id = (select auth.uid())
     and new.account_type is distinct from old.account_type then
    raise exception 'Changing account_type is not allowed for client updates';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_block_account_type_change on public.profiles;
create trigger profiles_block_account_type_change
  before update on public.profiles
  for each row execute function public.block_client_account_type_change();

create or replace function public.block_client_company_verification_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and old.user_id = (select auth.uid())
     and new.verification_status is distinct from old.verification_status then
    raise exception 'Changing verification_status is not allowed for client updates';
  end if;

  return new;
end;
$$;

drop trigger if exists company_profiles_block_verification_status_change on public.company_profiles;
create trigger company_profiles_block_verification_status_change
  before update on public.company_profiles
  for each row execute function public.block_client_company_verification_change();
