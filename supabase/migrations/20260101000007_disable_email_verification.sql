-- =====================================================================
-- QURANDAZI — 0007 Remove email verification
--
-- Sign-up no longer requires clicking an email link: members register,
-- sign in and go straight to their dashboard. Identity is established by
-- CNIC (KYC) review instead.
--
-- ALSO REQUIRED (dashboard setting, cannot be done in SQL):
--   Authentication -> Sign In / Providers -> Email -> turn OFF "Confirm email".
-- Run after 0006.
-- =====================================================================

-- Activate accounts that signed up earlier but never clicked the link
-- (the on_auth_user_updated trigger mirrors this into public.profiles).
update auth.users set email_confirmed_at = now()
 where email_confirmed_at is null;

-- Campaign rules no longer use 'email_verified'
delete from public.eligibility_rules where rule_type = 'email_verified';

-- Eligibility without any email-verification requirement (replaces 0005)
create or replace function public.evaluate_eligibility(p_user_id uuid, p_campaign_id uuid)
returns text[]
language plpgsql stable security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_role public.app_role;
  v_campaign public.campaigns;
  v_cat public.categories;
  v_rule record;
  v_reasons text[] := '{}';
  v_cities text[];
  v_req numeric;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  select role into v_role from public.user_roles where user_id = p_user_id;
  select * into v_campaign from public.campaigns where id = p_campaign_id;

  if v_campaign.id is null then
    return array['Campaign not found'];
  end if;
  if v_profile.id is null then
    return array['Profile not found'];
  end if;
  if v_profile.status <> 'active' then
    v_reasons := v_reasons || 'Your account is suspended'::text;
  end if;
  if v_role in ('admin', 'super_admin') then
    v_reasons := v_reasons || 'Staff accounts cannot participate in campaigns'::text;
  end if;
  if v_campaign.status <> 'active' or now() < v_campaign.start_date or now() >= v_campaign.end_date then
    v_reasons := v_reasons || 'This campaign is not currently open for entries'::text;
  end if;
  if exists (select 1 from public.draws d where d.campaign_id = p_campaign_id
             and d.status not in ('scheduled', 'cancelled')) then
    v_reasons := v_reasons || 'Entries for this campaign have been frozen'::text;
  end if;

  -- Deposit requirement (category-driven)
  select * into v_cat from public.categories where id = v_campaign.category_id;
  v_req := coalesce(v_cat.deposit_amount, 0);
  if v_req > 0 and v_role = 'user' then
    if v_profile.kyc_status <> 'verified' then
      v_reasons := v_reasons || (case v_profile.kyc_status
        when 'pending' then 'Your CNIC verification (KYC) is under review'
        when 'rejected' then 'Your CNIC verification was rejected — resubmit it from your profile'
        else 'Verify your identity: add your CNIC number and CNIC images to your profile' end)::text;
    end if;
    if public.qualifying_deposit(p_user_id, v_req, null) is null then
      if exists (select 1 from public.deposits d where d.user_id = p_user_id and d.status = 'pending' and d.amount >= v_req) then
        v_reasons := v_reasons || format('Your deposit of PKR %s or higher is still awaiting verification',
                                         to_char(v_req, 'FM999,999,999,990'));
      else
        v_reasons := v_reasons || format('Requires a verified, active deposit of PKR %s (%s) or higher',
                                         to_char(v_req, 'FM999,999,999,990'), v_cat.name);
      end if;
    end if;
  end if;

  for v_rule in select * from public.eligibility_rules where campaign_id = p_campaign_id loop
    case v_rule.rule_type
      when 'email_verified' then
        null; -- email verification is disabled; legacy rule is ignored
      when 'profile_complete' then
        if coalesce(trim(v_profile.full_name), '') = '' or coalesce(trim(v_profile.phone), '') = ''
           or coalesce(trim(v_profile.address), '') = '' then
          v_reasons := v_reasons || 'Complete your profile (full name, phone number and address)'::text;
        end if;
      when 'phone_required' then
        if coalesce(trim(v_profile.phone), '') = '' then
          v_reasons := v_reasons || 'Add a phone number to your profile'::text;
        end if;
      when 'min_account_age_days' then
        if v_rule.rule_value ~ '^\d+$' and
           v_profile.created_at > now() - (v_rule.rule_value::int * interval '1 day') then
          v_reasons := v_reasons || format('Your account must be at least %s days old', v_rule.rule_value);
        end if;
      when 'city_in' then
        select array_agg(lower(trim(c))) into v_cities
          from unnest(string_to_array(coalesce(v_rule.rule_value, ''), ',')) c where trim(c) <> '';
        if v_cities is not null and (v_profile.city is null or lower(trim(v_profile.city)) <> all (v_cities)) then
          v_reasons := v_reasons || format('This campaign is open to residents of: %s', v_rule.rule_value);
        end if;
      else null;
    end case;
  end loop;

  return v_reasons;
end;
$$;
revoke all on function public.evaluate_eligibility(uuid, uuid) from public, anon, authenticated;

-- CNIC submission without an email-verification precondition (replaces 0005)
create or replace function public.submit_kyc(p_cnic text, p_front_path text, p_back_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_cnic text := public.normalize_cnic(p_cnic);
begin
  if v_uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.id is null or v_profile.status <> 'active' then raise exception 'Your account is suspended' using errcode = '42501'; end if;
  if coalesce(trim(v_profile.full_name), '') = '' or coalesce(trim(v_profile.phone), '') = ''
     or coalesce(trim(v_profile.address), '') = '' then
    raise exception 'Complete your profile (full name, phone number and address) before submitting your CNIC';
  end if;
  if v_profile.kyc_status = 'verified' then raise exception 'Your identity is already verified'; end if;
  if v_profile.kyc_status = 'pending' then raise exception 'Your CNIC is already under review'; end if;
  if v_cnic is null then raise exception 'Enter a valid 13-digit CNIC number (e.g. 42101-1234567-1)'; end if;
  if exists (select 1 from public.profiles where cnic = v_cnic and id <> v_uid and kyc_status in ('pending', 'verified')) then
    raise exception 'This CNIC is already registered to another account' using errcode = '23505';
  end if;
  if coalesce(p_front_path, '') = '' or coalesce(p_back_path, '') = '' then
    raise exception 'Upload both the front and back of your CNIC';
  end if;
  if split_part(p_front_path, '/', 1) <> v_uid::text or split_part(p_back_path, '/', 1) <> v_uid::text
     or not public.storage_object_exists('kyc-documents', p_front_path)
     or not public.storage_object_exists('kyc-documents', p_back_path) then
    raise exception 'CNIC images were not found. Please upload them again.';
  end if;

  perform set_config('qz.kyc_write', 'on', true);
  update public.profiles
     set cnic = v_cnic, cnic_front_path = p_front_path, cnic_back_path = p_back_path,
         kyc_status = 'pending', kyc_note = null, kyc_submitted_at = now(),
         kyc_reviewed_by = null, kyc_reviewed_at = null
   where id = v_uid;
  perform set_config('qz.kyc_write', 'off', true);

  perform public.log_admin_action('kyc.submit', 'profiles', v_uid::text, jsonb_build_object('cnic_last4', right(v_cnic, 6)));
  insert into public.notifications (user_id, type, title, body, link)
  values (v_uid, 'kyc', 'CNIC submitted for verification',
          'We have received your CNIC. An administrator will review it shortly.', '/dashboard/profile');
end;
$$;
revoke execute on function public.submit_kyc(text, text, text) from anon;
