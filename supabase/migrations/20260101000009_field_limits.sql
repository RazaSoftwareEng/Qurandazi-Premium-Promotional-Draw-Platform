-- =====================================================================
-- QURANDAZI — 0009 Field limits enforced in the database
--
-- Mirrors the form limits so they cannot be bypassed through the API:
--   * full name  : max 60 characters
--   * phone      : a valid Pakistani mobile (03XXXXXXXXX, +92 3XX..., 923...)
--   * city       : max 80 characters (already), address max 300 (already)
--   * email      : max 254 characters
-- Constraints are added NOT VALID: existing rows are not re-checked, but
-- every new sign-up and every profile edit must satisfy them.
-- Run after 0008 (uses public.normalize_phone()).
-- =====================================================================

do $$ begin
  alter table public.profiles add constraint profiles_full_name_len_chk
    check (char_length(full_name) <= 60) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_phone_pk_mobile_chk
    check (phone is null or phone = '' or public.normalize_phone(phone) ~ '^03[0-9]{9}$') not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_email_len_chk
    check (email is null or char_length(email) <= 254) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.contact_messages add constraint contact_messages_name_len_chk
    check (char_length(name) <= 60) not valid;
exception when duplicate_object then null; end $$;

-- Sign-up: give a clear message instead of a generic database error
-- (replaces 0008 version)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9+\- ]', '', 'g'), '');
  if v_phone is not null and public.normalize_phone(v_phone) !~ '^03[0-9]{9}$' then
    raise exception 'Enter a valid Pakistani mobile number, e.g. 0300 1234567' using errcode = '22023';
  end if;

  if v_phone is not null and exists (
       select 1 from public.profiles where public.normalize_phone(phone) = public.normalize_phone(v_phone)) then
    raise exception 'This phone number is already registered to another account' using errcode = '23505';
  end if;

  insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
  values (new.id, left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 60), new.email, v_phone, new.email_confirmed_at)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
