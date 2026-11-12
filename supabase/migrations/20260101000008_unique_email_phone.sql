-- =====================================================================
-- QURANDAZI — 0008 One account per email and per phone number
--
-- * Phone numbers are compared in a normalised form, so "+92 300 1234567",
--   "0300-1234567" and "923001234567" are treated as the same number.
-- * Email is already unique in auth.users; profiles.email gets a matching
--   case-insensitive unique index as a second safety net.
-- * Sign-up with a phone number that is already registered is rejected.
-- * is_phone_available() lets the registration form show a clear message.
-- Run after 0007. If existing duplicates are found, the migration stops and
-- lists them so you can fix them first (nothing is changed silently).
-- =====================================================================

-- Canonical Pakistani-style phone: digits only, 92XXXXXXXXXX / 0092... -> 0XXXXXXXXXX
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql immutable
as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if v = '' then return null; end if;
  if v like '0092%' then v := substr(v, 5); v := '0' || v;
  elsif v like '92%' and char_length(v) = 12 then v := '0' || substr(v, 3);
  elsif v like '3%' and char_length(v) = 10 then v := '0' || v;
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- Stop if duplicates already exist
-- ---------------------------------------------------------------------
do $$
declare
  v_list text;
begin
  select string_agg(format('%s -> %s', k, emails), E'\n') into v_list
    from (
      select public.normalize_phone(phone) as k, string_agg(coalesce(email, id::text), ', ' order by created_at) as emails
        from public.profiles
       where public.normalize_phone(phone) is not null
       group by 1 having count(*) > 1
    ) d;
  if v_list is not null then
    raise exception E'Duplicate phone numbers found. Change or clear them in Admin -> Users, then run this migration again:\n%', v_list;
  end if;

  select string_agg(format('%s (%s accounts)', k, n), E'\n') into v_list
    from (select lower(email) as k, count(*) as n from public.profiles
           where email is not null group by 1 having count(*) > 1) d;
  if v_list is not null then
    raise exception E'Duplicate emails found in profiles:\n%', v_list;
  end if;
end $$;

create unique index if not exists profiles_phone_unique
  on public.profiles (public.normalize_phone(phone))
  where public.normalize_phone(phone) is not null;

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email is not null;

-- ---------------------------------------------------------------------
-- Sign-up: reject an already-registered phone with a clear message
-- (replaces 0002 version)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9+\- ]', '', 'g'), '');
  if v_phone is not null and v_phone !~ '^\+?[0-9][0-9 \-]{6,19}$' then v_phone := null; end if;

  if v_phone is not null and exists (
       select 1 from public.profiles where public.normalize_phone(phone) = public.normalize_phone(v_phone)) then
    raise exception 'This phone number is already registered to another account' using errcode = '23505';
  end if;

  insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), new.email, v_phone, new.email_confirmed_at)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Availability check for the registration / profile forms
-- ---------------------------------------------------------------------
create or replace function public.is_phone_available(p_phone text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.normalize_phone(p_phone) is not null
     and not exists (
       select 1 from public.profiles
        where public.normalize_phone(phone) = public.normalize_phone(p_phone)
          and id is distinct from auth.uid());
$$;
grant execute on function public.is_phone_available(text) to anon, authenticated;
