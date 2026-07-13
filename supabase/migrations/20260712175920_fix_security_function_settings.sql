alter function public.set_updated_at() set search_path = public;

alter function public.sync_conversation_last_message() set search_path = public;

alter function public.track_listing_status_event() set search_path = public;

alter function public.handle_new_auth_user_profile() set search_path = public, auth;

revoke execute on function public.handle_new_auth_user_profile() from public;
revoke execute on function public.handle_new_auth_user_profile() from anon;
revoke execute on function public.handle_new_auth_user_profile() from authenticated;