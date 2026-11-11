-- =====================================================================
-- QURANDAZI — 0006 Mobile-wallet payments + deposits before KYC
--
--  * Adds 'mobile_wallet' (EasyPaisa / JazzCash / NayaPay / SadaPay) as a
--    payment method and publishes the default wallet number.
--  * A member may now pay and submit a deposit while other steps (email,
--    profile, KYC) are still pending. The deposit simply waits for admin
--    verification. Joining a campaign STILL requires a verified email,
--    KYC-verified identity and a verified deposit (evaluate_eligibility).
-- Run after 0005.
-- =====================================================================

alter table public.deposits drop constraint if exists deposits_payment_method_check;
alter table public.deposits add constraint deposits_payment_method_check
  check (payment_method in ('bank_transfer', 'payment_gateway', 'mobile_wallet'));

-- Publish the wallet details (keeps anything an admin already entered)
update public.site_settings
   set value = value
     || jsonb_build_object('wallet_providers', coalesce(nullif(value ->> 'wallet_providers', ''), 'EasyPaisa / JazzCash / NayaPay / SadaPay'))
     || jsonb_build_object('wallet_number', coalesce(nullif(value ->> 'wallet_number', ''), '03003209005'))
 where key = 'deposit_terms';

create or replace function public.create_deposit(
  p_category_id uuid, p_payment_method text, p_transaction_id text,
  p_proof_path text default null, p_accept_terms boolean default false)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_role public.app_role;
  v_cat public.categories;
  v_txn text := trim(coalesce(p_transaction_id, ''));
  v_dep public.deposits;
  v_ref text;
  v_try int := 0;
  v_constraint text;
begin
  if v_uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  select role into v_role from public.user_roles where user_id = v_uid;
  if v_role is distinct from 'user' then raise exception 'Staff accounts cannot make deposits' using errcode = '42501'; end if;
  if v_profile.id is null or v_profile.status <> 'active' then raise exception 'Your account is suspended' using errcode = '42501'; end if;
  -- KYC is no longer required to SUBMIT a deposit; it is still required to join campaigns.
  if not coalesce(p_accept_terms, false) then raise exception 'You must accept the deposit terms'; end if;
  if p_payment_method not in ('bank_transfer', 'payment_gateway', 'mobile_wallet') then raise exception 'Select a payment method'; end if;
  if char_length(v_txn) < 4 or char_length(v_txn) > 100 then raise exception 'Enter the transaction ID from your payment'; end if;

  select * into v_cat from public.categories where id = p_category_id;
  if v_cat.id is null or not v_cat.is_active then raise exception 'Category not found'; end if;
  if coalesce(v_cat.deposit_amount, 0) <= 0 then raise exception 'This category does not accept deposits'; end if;

  if exists (select 1 from public.deposits where user_id = v_uid and category_id = p_category_id
             and status in ('pending', 'verified', 'withdrawal_requested')) then
    raise exception 'You already have an open % deposit', v_cat.name using errcode = '23505';
  end if;
  if exists (select 1 from public.deposits where lower(transaction_id) = lower(v_txn) and status <> 'rejected') then
    raise exception 'This transaction ID has already been submitted' using errcode = '23505';
  end if;
  if coalesce(p_proof_path, '') <> '' and (split_part(p_proof_path, '/', 1) <> v_uid::text
     or not public.storage_object_exists('deposit-proofs', p_proof_path)) then
    raise exception 'Payment proof was not found. Please upload it again.';
  end if;

  loop
    v_try := v_try + 1;
    v_ref := 'DP-' || to_char(now() at time zone 'utc', 'YYMM') || '-' || upper(encode(gen_random_bytes(4), 'hex'));
    begin
      insert into public.deposits (reference, user_id, category_id, amount, lock_in_days, terms_version,
                                   terms_accepted_at, payment_method, transaction_id, proof_path)
      values (v_ref, v_uid, v_cat.id, v_cat.deposit_amount, v_cat.deposit_lock_in_days,
              coalesce(public.deposit_terms() ->> 'version', 'v1'), now(), p_payment_method, v_txn,
              nullif(p_proof_path, ''))
      returning * into v_dep;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'deposits_one_open_per_category' then
        raise exception 'You already have an open % deposit', v_cat.name using errcode = '23505';
      elsif v_constraint = 'deposits_txn_unique' then
        raise exception 'This transaction ID has already been submitted' using errcode = '23505';
      end if;
      if v_try >= 5 then raise; end if;
    end;
  end loop;

  perform public.log_admin_action('deposit.submit', 'deposits', v_dep.id::text,
    jsonb_build_object('reference', v_dep.reference, 'category', v_cat.name, 'amount', v_dep.amount,
                       'payment_method', p_payment_method, 'transaction_id', v_txn,
                       'terms_version', v_dep.terms_version, 'kyc_status_at_submit', v_profile.kyc_status));
  insert into public.notifications (user_id, type, title, body, link)
  values (v_uid, 'deposit', 'Deposit submitted — pending verification',
          format('Your %s deposit %s of PKR %s is pending. We will verify it against our account statement.%s',
                 v_cat.name, v_dep.reference, to_char(v_dep.amount, 'FM999,999,999,990'),
                 case when v_profile.kyc_status <> 'verified'
                      then ' Complete your CNIC verification too — it is required before you can join campaigns.'
                      else '' end),
          '/dashboard/deposits');

  return jsonb_build_object('id', v_dep.id, 'reference', v_dep.reference, 'status', v_dep.status);
end;
$$;
revoke execute on function public.create_deposit(uuid, text, text, text, boolean) from anon;
