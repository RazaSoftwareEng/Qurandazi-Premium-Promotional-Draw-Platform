-- =====================================================================
-- QURANDAZI — 0011 Delete users from the database (no Edge Function needed)
--
-- admin_delete_user() replaces the "delete" action of the admin-users Edge
-- Function, so deleting a user works even when that function is not deployed.
-- Same rules as before, plus deposit protection:
--   * admins only; you cannot delete yourself
--   * only a Super Admin can delete staff accounts
--   * users with draw results or deposit records are kept (suspend instead)
-- Deleting the auth user cascades to profile, role, entries and notifications.
-- Run after 0010.
-- =====================================================================

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_role public.app_role;
  v_email text;
  v_name text;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot delete your own account' using errcode = '42501'; end if;

  select r.role into v_role from public.user_roles r where r.user_id = p_user_id;
  select p.email, p.full_name into v_email, v_name from public.profiles p where p.id = p_user_id;
  if v_role is null then raise exception 'User not found' using errcode = 'P0002'; end if;
  if v_role <> 'user' and not public.is_super_admin() then
    raise exception 'Only a Super Admin can delete staff accounts' using errcode = '42501';
  end if;
  if exists (select 1 from public.draw_results where user_id = p_user_id) then
    raise exception 'This user has draw results on record. Suspend the account instead of deleting it.' using errcode = '23503';
  end if;
  if exists (select 1 from public.deposits where user_id = p_user_id) then
    raise exception 'This user has deposit records, which must be kept. Suspend the account instead of deleting it.' using errcode = '23503';
  end if;

  -- Log first (the log row is append-only and survives the delete)
  perform public.log_admin_action('user.delete', 'profiles', p_user_id::text,
    jsonb_build_object('email', v_email, 'full_name', v_name, 'role', v_role));

  delete from auth.users where id = p_user_id;
end;
$$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
