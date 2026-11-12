-- =====================================================================
-- QURANDAZI — 0010 Login must never fail because of profile syncing
--
-- Fixes "Database error granting user" on sign-in.
--
-- On every login Supabase updates auth.users.last_sign_in_at, which fires
-- on_auth_user_updated -> public.profiles UPDATE. If that profile row breaks a
-- constraint (e.g. the 0009 phone / name limits on an older account), the
-- whole login transaction failed. The sync is now best-effort: problems are
-- logged as warnings and the login always succeeds.
-- Run after 0009.
-- =====================================================================

create or replace function public.handle_user_updated()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    update public.profiles
       set email = new.email,
           email_confirmed_at = new.email_confirmed_at,
           last_sign_in_at = new.last_sign_in_at
     where id = new.id;
  exception when others then
    raise warning 'handle_user_updated: profile sync skipped for % (%)', new.id, sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.handle_user_updated() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Clean up older rows that break the 0009 rules, so they can be edited again
-- ---------------------------------------------------------------------
-- Phones that are not valid Pakistani mobiles are cleared (the member can add
-- a correct one from their profile). Names longer than 60 chars are trimmed.
update public.profiles
   set phone = null
 where phone is not null and phone <> ''
   and coalesce(public.normalize_phone(phone), '') !~ '^03[0-9]{9}$';

update public.profiles
   set full_name = left(trim(full_name), 60)
 where char_length(full_name) > 60;

-- Now that existing rows comply, enforce the constraints for every row
alter table public.profiles validate constraint profiles_full_name_len_chk;
alter table public.profiles validate constraint profiles_phone_pk_mobile_chk;
alter table public.profiles validate constraint profiles_email_len_chk;
