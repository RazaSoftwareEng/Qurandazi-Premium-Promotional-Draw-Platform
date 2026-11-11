-- =====================================================================
-- QURANDAZI — 0005 KYC, refundable deposits, deposit-gated entries and
-- prize handovers.
--
-- Flow:
--   1. User verifies email, completes profile and submits CNIC (front/back)
--      -> admin reviews -> profile.kyc_status = 'verified'.
--   2. KYC-verified user submits a deposit for a category (amount, lock-in
--      and terms are snapshotted) with a transaction ID / proof -> 'pending'.
--   3. Admin verifies (or rejects with a reason) against the bank statement.
--   4. Joining a campaign requires a verified, active deposit in that
--      category's amount or higher.
--   5. At freeze, only entries whose deposit was active AT CLOSING are
--      included in the immutable snapshot.
--   6. Prize handover is recorded against the winner's verified CNIC.
--   7. User requests a withdrawal (after lock-in, or anytime if the terms
--      allow) -> admin records the payout transaction -> 'refunded'.
-- Every state change goes through SECURITY DEFINER functions and is
-- written to the append-only admin_activity_logs table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Notification types
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('announcement', 'campaign', 'entry', 'winner', 'result', 'system', 'deposit', 'kyc'));

-- ---------------------------------------------------------------------
-- Profiles: KYC
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists cnic             text,
  add column if not exists cnic_front_path  text,
  add column if not exists cnic_back_path   text,
  add column if not exists kyc_status       text not null default 'not_submitted',
  add column if not exists kyc_note         text,
  add column if not exists kyc_submitted_at timestamptz,
  add column if not exists kyc_reviewed_by  uuid,
  add column if not exists kyc_reviewed_at  timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_cnic_format_chk
    check (cnic is null or cnic ~ '^[0-9]{5}-[0-9]{7}-[0-9]$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_kyc_status_chk
    check (kyc_status in ('not_submitted', 'pending', 'verified', 'rejected'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_kyc_note_chk
    check (kyc_note is null or char_length(kyc_note) <= 500);
exception when duplicate_object then null; end $$;

-- One CNIC per account (blocks multi-accounting)
create unique index if not exists profiles_cnic_unique
  on public.profiles (cnic) where cnic is not null and kyc_status in ('pending', 'verified');
create index if not exists profiles_kyc_status_idx on public.profiles (kyc_status);

-- Profile guard (replaces 0002 version): KYC fields can only change inside
-- submit_kyc() / admin_review_kyc(), which set the transaction-local flag
-- qz.kyc_write. The verified name is locked for users.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_target_role public.app_role;
  v_kyc_write boolean := coalesce(current_setting('qz.kyc_write', true), '') = 'on';
begin
  if auth.uid() is null then
    return new;
  end if;

  new.id := old.id;
  new.email := old.email;
  new.email_confirmed_at := old.email_confirmed_at;
  new.last_sign_in_at := old.last_sign_in_at;
  new.created_at := old.created_at;

  if not v_kyc_write then
    new.cnic := old.cnic;
    new.cnic_front_path := old.cnic_front_path;
    new.cnic_back_path := old.cnic_back_path;
    new.kyc_status := old.kyc_status;
    new.kyc_note := old.kyc_note;
    new.kyc_submitted_at := old.kyc_submitted_at;
    new.kyc_reviewed_by := old.kyc_reviewed_by;
    new.kyc_reviewed_at := old.kyc_reviewed_at;
  end if;

  if public.is_admin() then
    if new.status is distinct from old.status then
      if new.id = auth.uid() then
        raise exception 'You cannot change the status of your own account' using errcode = '42501';
      end if;
      select role into v_target_role from public.user_roles where user_id = new.id;
      if v_target_role = 'super_admin' and not public.is_super_admin() then
        raise exception 'Only a Super Admin can change the status of a Super Admin' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  new.status := old.status;
  if not v_kyc_write and old.kyc_status in ('pending', 'verified')
     and new.full_name is distinct from old.full_name then
    raise exception 'Your name is locked while your CNIC is verified or under review. Contact support to change it.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.normalize_cnic(p_cnic text)
returns text
language plpgsql immutable
as $$
declare
  v text := regexp_replace(coalesce(p_cnic, ''), '[^0-9]', '', 'g');
begin
  if char_length(v) <> 13 then return null; end if;
  return substr(v, 1, 5) || '-' || substr(v, 6, 7) || '-' || substr(v, 13, 1);
end;
$$;

-- ---------------------------------------------------------------------
-- Categories: deposit requirement
-- ---------------------------------------------------------------------
alter table public.categories
  add column if not exists deposit_amount       numeric(12, 2),
  add column if not exists deposit_lock_in_days int not null default 30;
do $$ begin
  alter table public.categories add constraint categories_deposit_amount_chk
    check (deposit_amount is null or deposit_amount >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.categories add constraint categories_lock_in_chk
    check (deposit_lock_in_days between 0 and 3650);
exception when duplicate_object then null; end $$;

update public.categories set deposit_amount = reference_amount
 where deposit_amount is null and reference_amount is not null;

-- ---------------------------------------------------------------------
-- Deposits
-- ---------------------------------------------------------------------
create table if not exists public.deposits (
  id                      uuid primary key default gen_random_uuid(),
  reference               text not null unique,
  user_id                 uuid not null references public.profiles (id) on delete restrict,
  category_id             uuid not null references public.categories (id) on delete restrict,
  amount                  numeric(12, 2) not null check (amount > 0),
  lock_in_days            int not null check (lock_in_days >= 0),
  terms_version           text not null,
  terms_accepted_at       timestamptz not null,
  payment_method          text not null check (payment_method in ('bank_transfer', 'payment_gateway')),
  transaction_id          text not null check (char_length(transaction_id) between 4 and 100),
  proof_path              text check (proof_path is null or char_length(proof_path) <= 500),
  status                  text not null default 'pending'
                          check (status in ('pending', 'verified', 'rejected', 'withdrawal_requested', 'refunded')),
  rejection_reason        text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  reviewed_by             uuid,
  reviewed_at             timestamptz,
  verified_at             timestamptz,
  locked_until            timestamptz,
  withdrawal_requested_at timestamptz,
  payout_details          text check (payout_details is null or char_length(payout_details) <= 500),
  refunded_by             uuid,
  refunded_at             timestamptz,
  payout_transaction_id   text check (payout_transaction_id is null or char_length(payout_transaction_id) <= 100),
  refund_note             text check (refund_note is null or char_length(refund_note) <= 500),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists deposits_user_idx on public.deposits (user_id, created_at desc);
create index if not exists deposits_status_idx on public.deposits (status, created_at);
-- One open deposit per user per category
create unique index if not exists deposits_one_open_per_category
  on public.deposits (user_id, category_id) where status in ('pending', 'verified', 'withdrawal_requested');
-- A bank transaction can back only one deposit
create unique index if not exists deposits_txn_unique
  on public.deposits (lower(transaction_id)) where status <> 'rejected';

create trigger deposits_updated_at before update on public.deposits
  for each row execute function public.set_updated_at();

create or replace function public.guard_deposit_update()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('rejected', 'refunded') then
    raise exception 'This deposit is finalized and cannot be modified' using errcode = '42501';
  end if;
  if new.id <> old.id or new.reference <> old.reference or new.user_id <> old.user_id
     or new.category_id <> old.category_id or new.amount <> old.amount or new.lock_in_days <> old.lock_in_days
     or new.transaction_id <> old.transaction_id or new.proof_path is distinct from old.proof_path
     or new.payment_method <> old.payment_method or new.terms_version <> old.terms_version
     or new.terms_accepted_at <> old.terms_accepted_at or new.created_at <> old.created_at then
    raise exception 'Submitted deposit details are immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'pending' and new.status in ('verified', 'rejected')) or
       (old.status = 'verified' and new.status = 'withdrawal_requested') or
       (old.status = 'withdrawal_requested' and new.status = 'refunded')) then
    raise exception 'Invalid deposit status change: % -> %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger deposits_guard before update on public.deposits
  for each row execute function public.guard_deposit_update();
create trigger deposits_no_delete before delete on public.deposits
  for each row execute function public.prevent_mutation();

-- Entries remember which deposit qualified them at join time
alter table public.entries
  add column if not exists deposit_id uuid references public.deposits (id) on delete restrict;
create index if not exists entries_deposit_idx on public.entries (deposit_id);

-- Draws record the deposit rule applied at freeze time
alter table public.draws
  add column if not exists required_deposit numeric(12, 2),
  add column if not exists excluded_entries int;

-- ---------------------------------------------------------------------
-- Prize handovers (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.prize_handovers (
  id                uuid primary key default gen_random_uuid(),
  draw_result_id    uuid not null unique references public.draw_results (id) on delete restrict,
  draw_id           uuid not null,
  campaign_id       uuid not null,
  user_id           uuid not null,
  prize_description text not null check (char_length(prize_description) between 2 and 500),
  presented_cnic    text not null check (presented_cnic ~ '^[0-9]{5}-[0-9]{7}-[0-9]$'),
  cnic_matched      boolean not null,
  handed_over_on    date not null,
  document_paths    text[] not null default '{}',
  notes             text check (notes is null or char_length(notes) <= 2000),
  recorded_by       uuid not null,
  created_at        timestamptz not null default now()
);
create index if not exists prize_handovers_user_idx on public.prize_handovers (user_id);
create trigger immutable_prize_handovers before update or delete on public.prize_handovers
  for each row execute function public.prevent_mutation();

-- ---------------------------------------------------------------------
-- Deposit terms (public site setting; bank details are shown to depositors)
-- ---------------------------------------------------------------------
insert into public.site_settings (key, value, description) values
  ('deposit_terms', jsonb_build_object(
     'version', 'v1',
     'allow_early_withdrawal', false,
     'bank_name', '',
     'account_title', '',
     'account_number', '',
     'iban', '',
     'gateway_instructions', '',
     'terms_text', E'Your deposit is not a fee. It is held in the company''s account and returned to you in full, as set out in these terms.\nThe deposit stays locked for the lock-in period shown for its category. After that you can request a withdrawal from your dashboard at any time.\nWhile your deposit is verified and active, you can join campaigns in its category and in any lower category.\nIf you withdraw your deposit before a campaign closes, your entry in that campaign is automatically excluded from its draw.\nRefunds are paid to the account you provide, and the payout transaction ID is recorded on your deposit.'
   ), 'Refundable deposit terms, payment details and withdrawal policy')
on conflict (key) do nothing;

-- Replace the old "no deposit" homepage copy if it was never customised
update public.site_settings
   set value = jsonb_set(value, '{hero_subtitle}',
         to_jsonb('Promotional campaigns with transparent, independently verifiable draws. Your deposit is refundable, never a fee.'::text))
 where key = 'homepage'
   and value ->> 'hero_subtitle' = 'Free-entry promotional campaigns with transparent, independently verifiable draws. No purchase. No deposit. Just your moment.';

-- ---------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------
-- Returns the best deposit that qualifies p_user for a requirement of p_min.
--   p_at IS NULL  -> a deposit that is active now (status 'verified')
--   p_at = ts     -> a deposit that was active at ts (verified before ts and
--                    no withdrawal requested before ts)
create or replace function public.qualifying_deposit(p_user uuid, p_min numeric, p_at timestamptz default null)
returns uuid
language sql stable security definer set search_path = public
as $$
  select d.id
    from public.deposits d
   where d.user_id = p_user
     and d.amount >= p_min
     and case
           when p_at is null then d.status = 'verified'
           else d.verified_at is not null
                and d.verified_at <= p_at
                and d.status in ('verified', 'withdrawal_requested', 'refunded')
                and (d.withdrawal_requested_at is null or d.withdrawal_requested_at > p_at)
         end
   order by d.amount desc, d.verified_at
   limit 1;
$$;

create or replace function public.storage_object_exists(p_bucket text, p_path text)
returns boolean
language sql stable security definer set search_path = public, storage
as $$
  select exists (select 1 from storage.objects o where o.bucket_id = p_bucket and o.name = p_path);
$$;

create or replace function public.deposit_terms()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce((select value from public.site_settings where key = 'deposit_terms'), '{}'::jsonb);
$$;

-- Campaigns whose entry would lose its qualifying deposit if p_deposit_id were withdrawn now
create or replace function public.deposit_withdrawal_impact(p_deposit_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'campaign_id', c.id, 'title', c.title, 'slug', c.slug,
           'reference', e.reference, 'end_date', c.end_date) order by c.end_date), '[]'::jsonb)
    from public.deposits d
    join public.entries e on e.user_id = d.user_id and e.status in ('confirmed', 'verified')
    join public.campaigns c on c.id = e.campaign_id
    join public.categories cat on cat.id = c.category_id
   where d.id = p_deposit_id
     and c.end_date > now()
     and c.status not in ('cancelled', 'completed', 'closed')
     and coalesce(cat.deposit_amount, 0) > 0
     and d.amount >= cat.deposit_amount
     and not exists (
       select 1 from public.deposits o
        where o.user_id = d.user_id and o.id <> d.id and o.status = 'verified' and o.amount >= cat.deposit_amount);
$$;

-- ---------------------------------------------------------------------
-- KYC
-- ---------------------------------------------------------------------
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
  if v_profile.email_confirmed_at is null then raise exception 'Verify your email address first'; end if;
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

create or replace function public.admin_review_kyc(p_user_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_decision not in ('verified', 'rejected') then raise exception 'Invalid decision'; end if;
  if p_decision = 'rejected' and char_length(coalesce(trim(p_note), '')) < 5 then
    raise exception 'A reason is required when rejecting a CNIC (min. 5 characters)';
  end if;
  if p_user_id = auth.uid() then raise exception 'You cannot review your own CNIC' using errcode = '42501'; end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if v_profile.id is null then raise exception 'User not found'; end if;
  if v_profile.kyc_status <> 'pending' then raise exception 'Only pending CNIC submissions can be reviewed'; end if;

  perform set_config('qz.kyc_write', 'on', true);
  update public.profiles
     set kyc_status = p_decision, kyc_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
         kyc_reviewed_by = auth.uid(), kyc_reviewed_at = now()
   where id = p_user_id;
  perform set_config('qz.kyc_write', 'off', true);

  perform public.log_admin_action('kyc.' || p_decision, 'profiles', p_user_id::text,
    jsonb_build_object('cnic', v_profile.cnic, 'note', p_note));

  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, 'kyc',
          case when p_decision = 'verified' then 'Identity verified' else 'CNIC verification unsuccessful' end,
          case when p_decision = 'verified'
               then 'Your account is now KYC Verified. You can make a deposit to become eligible for campaigns.'
               else format('Your CNIC could not be verified. Reason: %s. Please resubmit from your profile.', p_note) end,
          case when p_decision = 'verified' then '/dashboard/deposits' else '/dashboard/profile' end);
end;
$$;

-- ---------------------------------------------------------------------
-- Deposits: user actions
-- ---------------------------------------------------------------------
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
  if v_profile.status <> 'active' then raise exception 'Your account is suspended' using errcode = '42501'; end if;
  if v_profile.kyc_status <> 'verified' then
    raise exception 'Only KYC-verified users can make deposits. Submit your CNIC from your profile first.' using errcode = '42501';
  end if;
  if not coalesce(p_accept_terms, false) then raise exception 'You must accept the deposit terms'; end if;
  if p_payment_method not in ('bank_transfer', 'payment_gateway') then raise exception 'Select a payment method'; end if;
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
                       'transaction_id', v_txn, 'terms_version', v_dep.terms_version));
  insert into public.notifications (user_id, type, title, body, link)
  values (v_uid, 'deposit', 'Deposit submitted — pending verification',
          format('Your %s deposit %s of PKR %s is pending. We will verify it against our bank statement.',
                 v_cat.name, v_dep.reference, to_char(v_dep.amount, 'FM999,999,999,990')),
          '/dashboard/deposits');

  return jsonb_build_object('id', v_dep.id, 'reference', v_dep.reference, 'status', v_dep.status);
end;
$$;

create or replace function public.get_deposit_withdrawal_impact(p_deposit_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.deposits where id = p_deposit_id and (user_id = auth.uid() or public.is_admin())) then
    raise exception 'Deposit not found' using errcode = 'P0002';
  end if;
  return public.deposit_withdrawal_impact(p_deposit_id);
end;
$$;

create or replace function public.request_deposit_withdrawal(p_deposit_id uuid, p_payout_details text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_dep public.deposits;
  v_cat public.categories;
  v_impact jsonb;
  v_early boolean := coalesce((public.deposit_terms() ->> 'allow_early_withdrawal')::boolean, false);
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into v_dep from public.deposits where id = p_deposit_id and user_id = auth.uid() for update;
  if v_dep.id is null then raise exception 'Deposit not found' using errcode = 'P0002'; end if;
  if v_dep.status <> 'verified' then raise exception 'Only verified deposits can be withdrawn'; end if;
  if not v_early and v_dep.locked_until is not null and now() < v_dep.locked_until then
    raise exception 'This deposit is locked until %', to_char(v_dep.locked_until at time zone 'Asia/Karachi', 'DD Mon YYYY HH24:MI "PKT"');
  end if;
  if char_length(coalesce(trim(p_payout_details), '')) < 5 then
    raise exception 'Enter the bank account details for your refund';
  end if;
  select * into v_cat from public.categories where id = v_dep.category_id;

  v_impact := public.deposit_withdrawal_impact(p_deposit_id);

  update public.deposits
     set status = 'withdrawal_requested', withdrawal_requested_at = now(), payout_details = left(trim(p_payout_details), 500)
   where id = p_deposit_id;

  perform public.log_admin_action('deposit.withdrawal_request', 'deposits', p_deposit_id::text,
    jsonb_build_object('reference', v_dep.reference, 'amount', v_dep.amount, 'excluded_entries', v_impact));

  insert into public.notifications (user_id, type, title, body, link)
  values (auth.uid(), 'deposit', 'Withdrawal requested',
          format('Your withdrawal request for %s (PKR %s) has been received.%s',
                 v_dep.reference, to_char(v_dep.amount, 'FM999,999,999,990'),
                 case when jsonb_array_length(v_impact) > 0
                      then format(' Your entries in %s open campaign(s) will be excluded from their draws.', jsonb_array_length(v_impact))
                      else '' end),
          '/dashboard/deposits');

  return jsonb_build_object('status', 'withdrawal_requested', 'excluded', v_impact);
end;
$$;

-- ---------------------------------------------------------------------
-- Deposits: admin actions
-- ---------------------------------------------------------------------
create or replace function public.admin_review_deposit(p_deposit_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_dep public.deposits;
  v_cat public.categories;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_decision not in ('verified', 'rejected') then raise exception 'Invalid decision'; end if;
  if p_decision = 'rejected' and char_length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'A reason is required when rejecting a deposit (min. 5 characters)';
  end if;

  select * into v_dep from public.deposits where id = p_deposit_id for update;
  if v_dep.id is null then raise exception 'Deposit not found'; end if;
  if v_dep.status <> 'pending' then raise exception 'Only pending deposits can be reviewed'; end if;
  if v_dep.user_id = auth.uid() then raise exception 'You cannot review your own deposit' using errcode = '42501'; end if;
  select * into v_cat from public.categories where id = v_dep.category_id;

  if p_decision = 'verified' then
    update public.deposits
       set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now(), verified_at = now(),
           locked_until = now() + make_interval(days => v_dep.lock_in_days)
     where id = p_deposit_id;
  else
    update public.deposits
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = left(trim(p_reason), 500)
     where id = p_deposit_id;
  end if;

  perform public.log_admin_action('deposit.' || p_decision, 'deposits', p_deposit_id::text,
    jsonb_build_object('reference', v_dep.reference, 'user_id', v_dep.user_id, 'amount', v_dep.amount,
                       'transaction_id', v_dep.transaction_id, 'reason', p_reason));

  insert into public.notifications (user_id, type, title, body, link)
  values (v_dep.user_id, 'deposit',
          case when p_decision = 'verified'
               then format('Deposit verified — you''re now eligible for %s campaigns.', v_cat.name)
               else 'Deposit could not be verified' end,
          case when p_decision = 'verified'
               then format('Deposit %s (PKR %s) is verified and locked until %s. It also qualifies you for lower-tier campaigns.',
                           v_dep.reference, to_char(v_dep.amount, 'FM999,999,999,990'),
                           to_char((now() + make_interval(days => v_dep.lock_in_days)) at time zone 'Asia/Karachi', 'DD Mon YYYY'))
               else format('Deposit %s was rejected. Reason: %s', v_dep.reference, p_reason) end,
          case when p_decision = 'verified' then '/dashboard/campaigns' else '/dashboard/deposits' end);
end;
$$;

create or replace function public.admin_complete_refund(p_deposit_id uuid, p_payout_transaction_id text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_dep public.deposits;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_payout_transaction_id), '')) < 4 then
    raise exception 'Enter the payout transaction ID';
  end if;
  select * into v_dep from public.deposits where id = p_deposit_id for update;
  if v_dep.id is null then raise exception 'Deposit not found'; end if;
  if v_dep.status <> 'withdrawal_requested' then raise exception 'Only requested withdrawals can be refunded'; end if;

  update public.deposits
     set status = 'refunded', refunded_by = auth.uid(), refunded_at = now(),
         payout_transaction_id = left(trim(p_payout_transaction_id), 100),
         refund_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
   where id = p_deposit_id;

  perform public.log_admin_action('deposit.refunded', 'deposits', p_deposit_id::text,
    jsonb_build_object('reference', v_dep.reference, 'user_id', v_dep.user_id, 'amount', v_dep.amount,
                       'payout_transaction_id', trim(p_payout_transaction_id), 'note', p_note));

  insert into public.notifications (user_id, type, title, body, link)
  values (v_dep.user_id, 'deposit', 'Deposit refunded',
          format('PKR %s for deposit %s has been refunded. Payout transaction ID: %s.',
                 to_char(v_dep.amount, 'FM999,999,999,990'), v_dep.reference, trim(p_payout_transaction_id)),
          '/dashboard/deposits');
end;
$$;

-- ---------------------------------------------------------------------
-- Eligibility (replaces 0002 version): adds KYC + deposit requirement
-- ---------------------------------------------------------------------
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
    if v_profile.email_confirmed_at is null then
      v_reasons := v_reasons || 'Verify your email address'::text;
    end if;
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
        if v_profile.email_confirmed_at is null and not ('Verify your email address' = any (v_reasons)) then
          v_reasons := v_reasons || 'Verify your email address'::text;
        end if;
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

create or replace function public.check_campaign_eligibility(p_campaign_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_entry public.entries;
  v_reasons text[];
  v_req numeric;
  v_cat_name text;
  v_profile public.profiles;
  v_deposit uuid;
begin
  select coalesce(cat.deposit_amount, 0), cat.name into v_req, v_cat_name
    from public.campaigns c left join public.categories cat on cat.id = c.category_id
   where c.id = p_campaign_id;

  if auth.uid() is null then
    return jsonb_build_object('authenticated', false, 'eligible', false, 'already_joined', false,
                              'reasons', '[]'::jsonb, 'required_deposit', nullif(v_req, 0), 'category_name', v_cat_name);
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  select * into v_entry from public.entries where campaign_id = p_campaign_id and user_id = auth.uid();
  v_reasons := public.evaluate_eligibility(auth.uid(), p_campaign_id);
  if v_req > 0 then v_deposit := public.qualifying_deposit(auth.uid(), v_req, null); end if;

  return jsonb_build_object(
    'authenticated', true,
    'already_joined', v_entry.id is not null,
    'entry_reference', v_entry.reference,
    'entry_status', v_entry.status,
    'eligible', v_entry.id is null and coalesce(array_length(v_reasons, 1), 0) = 0,
    'reasons', to_jsonb(coalesce(v_reasons, '{}')),
    'required_deposit', nullif(v_req, 0),
    'category_name', v_cat_name,
    'kyc_status', v_profile.kyc_status,
    'deposit_active', v_req = 0 or v_deposit is not null,
    'pending_deposit', v_req > 0 and exists (select 1 from public.deposits d where d.user_id = auth.uid()
                                             and d.status = 'pending' and d.amount >= v_req)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Join (replaces 0002 version): records the qualifying deposit
-- ---------------------------------------------------------------------
create or replace function public.join_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_campaign public.campaigns;
  v_reasons text[];
  v_entry public.entries;
  v_ref text;
  v_try int := 0;
  v_req numeric;
  v_deposit uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in to join this campaign' using errcode = '28000';
  end if;

  select * into v_campaign from public.campaigns where id = p_campaign_id for share;
  if v_campaign.id is null then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.entries where campaign_id = p_campaign_id and user_id = v_uid) then
    raise exception 'You have already joined this campaign' using errcode = '23505';
  end if;

  v_reasons := public.evaluate_eligibility(v_uid, p_campaign_id);
  if coalesce(array_length(v_reasons, 1), 0) > 0 then
    raise exception '%', v_reasons[1] using errcode = 'P0001', detail = array_to_string(v_reasons, ' | ');
  end if;

  select coalesce(deposit_amount, 0) into v_req from public.categories where id = v_campaign.category_id;
  if coalesce(v_req, 0) > 0 then
    v_deposit := public.qualifying_deposit(v_uid, v_req, null);
    if v_deposit is null then
      raise exception 'Requires a verified, active deposit of PKR % or higher', to_char(v_req, 'FM999,999,999,990');
    end if;
  end if;

  loop
    v_try := v_try + 1;
    v_ref := 'QZ-' || to_char(now() at time zone 'utc', 'YYMM') || '-' || upper(encode(gen_random_bytes(4), 'hex'));
    begin
      insert into public.entries (reference, campaign_id, user_id, deposit_id)
      values (v_ref, p_campaign_id, v_uid, v_deposit)
      returning * into v_entry;
      exit;
    exception when unique_violation then
      if exists (select 1 from public.entries where campaign_id = p_campaign_id and user_id = v_uid) then
        raise exception 'You have already joined this campaign' using errcode = '23505';
      end if;
      if v_try >= 5 then raise; end if;
    end;
  end loop;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_uid, 'entry', 'Entry confirmed',
          format('Your entry %s for "%s" has been recorded. Keep your deposit active until the campaign closes to stay in the draw.',
                 v_entry.reference, v_campaign.title),
          '/dashboard/entries');

  return jsonb_build_object('id', v_entry.id, 'reference', v_entry.reference,
                            'campaign_id', v_entry.campaign_id, 'created_at', v_entry.created_at);
end;
$$;

-- ---------------------------------------------------------------------
-- Freeze (replaces 0002 version): only entries whose deposit was still
-- active at the campaign's closing time are included in the snapshot.
-- ---------------------------------------------------------------------
create or replace function public.freeze_draw(p_draw_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_draw public.draws;
  v_campaign public.campaigns;
  v_count int;
  v_candidates int;
  v_hash text;
  v_seed text;
  v_commit text;
  v_req numeric;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;

  select * into v_draw from public.draws where id = p_draw_id for update;
  if v_draw.id is null then raise exception 'Draw not found'; end if;
  if v_draw.status <> 'scheduled' then raise exception 'Only scheduled draws can be frozen'; end if;

  select * into v_campaign from public.campaigns where id = v_draw.campaign_id for update;
  if now() < v_campaign.end_date then
    raise exception 'Entries can be frozen only after the campaign closes (%)', v_campaign.end_date;
  end if;
  select coalesce(deposit_amount, 0) into v_req from public.categories where id = v_campaign.category_id;
  v_req := coalesce(v_req, 0);

  select count(*) into v_candidates
    from public.entries e join public.profiles p on p.id = e.user_id
   where e.campaign_id = v_campaign.id and e.status in ('confirmed', 'verified')
     and e.created_at <= v_campaign.end_date and p.status = 'active';

  insert into public.draw_snapshots (draw_id, position, entry_id, entry_reference, user_id, entry_created_at)
  select v_draw.id,
         row_number() over (order by e.created_at, e.id),
         e.id, e.reference, e.user_id, e.created_at
    from public.entries e
    join public.profiles p on p.id = e.user_id
   where e.campaign_id = v_campaign.id
     and e.status in ('confirmed', 'verified')
     and e.created_at <= v_campaign.end_date
     and p.status = 'active'
     and (v_req = 0 or public.qualifying_deposit(e.user_id, v_req, v_campaign.end_date) is not null);
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'There are no eligible entries to freeze (% entr(ies) excluded for missing an active deposit at closing)',
      v_candidates;
  end if;

  select encode(digest(string_agg(s.position::text || ':' || s.entry_reference, E'\n' order by s.position), 'sha256'), 'hex')
    into v_hash
    from public.draw_snapshots s where s.draw_id = v_draw.id;

  v_seed := encode(gen_random_bytes(32), 'hex');
  v_commit := encode(digest(v_seed, 'sha256'), 'hex');
  insert into public.draw_secrets (draw_id, seed) values (v_draw.id, v_seed);

  update public.draws
     set status = 'frozen', entry_count = v_count, winners_count = least(v_draw.winners_count, v_count),
         snapshot_hash = v_hash, seed_commitment = v_commit, frozen_by = auth.uid(), frozen_at = now(),
         required_deposit = nullif(v_req, 0), excluded_entries = v_candidates - v_count
   where id = v_draw.id;

  update public.campaigns set status = 'closed' where id = v_campaign.id and status in ('active', 'upcoming');

  perform public.log_admin_action('draw.freeze', 'draws', v_draw.id::text,
    jsonb_build_object('entry_count', v_count, 'excluded_no_active_deposit', v_candidates - v_count,
                       'required_deposit', v_req, 'snapshot_hash', v_hash, 'seed_commitment', v_commit));

  return jsonb_build_object('entry_count', v_count, 'excluded_entries', v_candidates - v_count,
                            'snapshot_hash', v_hash, 'seed_commitment', v_commit);
end;
$$;

-- Audit view (replaces 0002 version): exposes the deposit rule used at freeze
create or replace function public.get_draw_audit(p_draw_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_draw public.draws;
  v_campaign public.campaigns;
  v_admin boolean := public.is_admin();
begin
  select * into v_draw from public.draws where id = p_draw_id;
  if v_draw.id is null or (v_draw.status <> 'published' and not v_admin) then
    raise exception 'Draw not found' using errcode = 'P0002';
  end if;
  select * into v_campaign from public.campaigns where id = v_draw.campaign_id;

  return jsonb_build_object(
    'draw', jsonb_build_object(
      'id', v_draw.id, 'title', v_draw.title, 'status', v_draw.status,
      'campaign_id', v_campaign.id, 'campaign_title', v_campaign.title, 'campaign_slug', v_campaign.slug,
      'scheduled_at', v_draw.scheduled_at, 'winners_count', v_draw.winners_count,
      'algorithm_version', v_draw.algorithm_version, 'entry_count', v_draw.entry_count,
      'required_deposit', v_draw.required_deposit, 'excluded_entries', v_draw.excluded_entries,
      'snapshot_hash', v_draw.snapshot_hash, 'seed_commitment', v_draw.seed_commitment,
      'seed_reveal', v_draw.seed_reveal,
      'frozen_at', v_draw.frozen_at, 'executed_at', v_draw.executed_at,
      'approved_at', v_draw.approved_at, 'published_at', v_draw.published_at,
      'frozen_by', (select full_name from public.profiles where id = v_draw.frozen_by and v_admin),
      'executed_by', (select full_name from public.profiles where id = v_draw.executed_by and v_admin),
      'approved_by', (select full_name from public.profiles where id = v_draw.approved_by and v_admin),
      'published_by', (select full_name from public.profiles where id = v_draw.published_by and v_admin)
    ),
    'snapshot', coalesce((
      select jsonb_agg(jsonb_build_object('position', s.position, 'reference', s.entry_reference) order by s.position)
        from public.draw_snapshots s where s.draw_id = p_draw_id), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', r.rank, 'position', r.snapshot_position, 'reference', r.entry_reference,
               'winner', r.winner_display_name, 'derivation', r.derivation, 'pool_size', r.pool_size,
               'user_id', case when v_admin then r.user_id end) order by r.rank)
        from public.draw_results r where r.draw_id = p_draw_id), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Prize handover
-- Returns {ok:true,id} or {ok:false,reason:'cnic_mismatch'} so that a
-- failed CNIC match is still written to the audit log.
-- ---------------------------------------------------------------------
create or replace function public.admin_record_handover(
  p_result_id uuid, p_presented_cnic text, p_handed_over_on date, p_prize_description text,
  p_document_paths text[], p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result public.draw_results;
  v_draw public.draws;
  v_profile public.profiles;
  v_cnic text := public.normalize_cnic(p_presented_cnic);
  v_path text;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;

  select * into v_result from public.draw_results where id = p_result_id;
  if v_result.id is null then raise exception 'Winner record not found'; end if;
  select * into v_draw from public.draws where id = v_result.draw_id;
  if v_draw.status <> 'published' then raise exception 'Prizes can be handed over only after results are published'; end if;
  if exists (select 1 from public.prize_handovers where draw_result_id = p_result_id) then
    raise exception 'A handover has already been recorded for this winner' using errcode = '23505';
  end if;

  select * into v_profile from public.profiles where id = v_result.user_id;
  if v_profile.kyc_status <> 'verified' or v_profile.cnic is null then
    raise exception 'The winner does not have a verified CNIC on file';
  end if;
  if v_cnic is null then raise exception 'Enter the 13-digit CNIC number from the presented card'; end if;
  if p_handed_over_on is null or p_handed_over_on > (now() at time zone 'Asia/Karachi')::date then
    raise exception 'Enter a valid handover date (not in the future)';
  end if;
  if char_length(coalesce(trim(p_prize_description), '')) < 2 then raise exception 'Describe the prize handed over'; end if;
  if coalesce(array_length(p_document_paths, 1), 0) = 0 then
    raise exception 'Attach at least one handover document (e.g. signed receipt, photo)';
  end if;
  foreach v_path in array p_document_paths loop
    if not public.storage_object_exists('handover-documents', v_path) then
      raise exception 'Document % was not found. Please upload it again.', v_path;
    end if;
  end loop;

  if v_cnic <> v_profile.cnic then
    perform public.log_admin_action('handover.cnic_mismatch', 'draw_results', p_result_id::text,
      jsonb_build_object('entry_reference', v_result.entry_reference, 'presented_cnic', v_cnic));
    return jsonb_build_object('ok', false, 'reason', 'cnic_mismatch');
  end if;

  insert into public.prize_handovers (draw_result_id, draw_id, campaign_id, user_id, prize_description, presented_cnic,
                                      cnic_matched, handed_over_on, document_paths, notes, recorded_by)
  values (p_result_id, v_result.draw_id, v_result.campaign_id, v_result.user_id, trim(p_prize_description), v_cnic,
          true, p_handed_over_on, p_document_paths, nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_id;

  perform public.log_admin_action('handover.record', 'prize_handovers', v_id::text,
    jsonb_build_object('draw_result_id', p_result_id, 'entry_reference', v_result.entry_reference,
                       'prize', p_prize_description, 'handed_over_on', p_handed_over_on, 'documents', p_document_paths));

  insert into public.notifications (user_id, type, title, body, link)
  values (v_result.user_id, 'winner', 'Prize handover recorded',
          format('The handover of "%s" for entry %s was recorded on %s. Congratulations!',
                 trim(p_prize_description), v_result.entry_reference, to_char(p_handed_over_on, 'DD Mon YYYY')),
          '/dashboard/draw-history');

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Analytics (replaces 0002 version)
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles p join public.user_roles r on r.user_id = p.id where r.role = 'user'),
    'active_users', (select count(*) from public.profiles p join public.user_roles r on r.user_id = p.id
                      where r.role = 'user' and p.status = 'active'),
    'active_30d', (select count(*) from public.profiles where last_sign_in_at > now() - interval '30 days'),
    'suspended_users', (select count(*) from public.profiles where status = 'suspended'),
    'total_campaigns', (select count(*) from public.campaigns),
    'active_campaigns', (select count(*) from public.campaigns where status = 'active' and now() between start_date and end_date),
    'total_entries', (select count(*) from public.entries),
    'completed_draws', (select count(*) from public.draws where status = 'published'),
    'pending_approvals', (select count(*) from public.draws where status = 'drawn'),
    'unread_messages', (select count(*) from public.contact_messages where status = 'new'),
    'pending_kyc', (select count(*) from public.profiles where kyc_status = 'pending'),
    'kyc_verified', (select count(*) from public.profiles where kyc_status = 'verified'),
    'pending_deposits', (select count(*) from public.deposits where status = 'pending'),
    'pending_withdrawals', (select count(*) from public.deposits where status = 'withdrawal_requested'),
    'active_deposits', (select count(*) from public.deposits where status = 'verified'),
    'active_deposit_total', (select coalesce(sum(amount), 0) from public.deposits where status in ('verified', 'withdrawal_requested'))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.deposits enable row level security;
alter table public.prize_handovers enable row level security;

create policy "deposits: read own" on public.deposits
  for select to authenticated using (user_id = auth.uid());
create policy "deposits: admin read" on public.deposits
  for select to authenticated using (public.is_admin());
-- No write policies: create_deposit / admin_review_deposit / request_deposit_withdrawal / admin_complete_refund only.

create policy "handovers: admin read" on public.prize_handovers
  for select to authenticated using (public.is_admin());
create policy "handovers: read own" on public.prize_handovers
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Private storage: CNIC images, payment proofs, handover documents
-- Files are read through short-lived signed URLs only.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc-documents', 'kyc-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('deposit-proofs', 'deposit-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('handover-documents', 'handover-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Users: upload & read only inside their own folder; no update/delete (evidence is preserved)
create policy "storage: users upload own private docs" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('kyc-documents', 'deposit-proofs') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: users read own private docs" on storage.objects
  for select to authenticated
  using (bucket_id in ('kyc-documents', 'deposit-proofs') and (storage.foldername(name))[1] = auth.uid()::text);
-- Admins: read all private docs; manage handover documents
create policy "storage: admins read private docs" on storage.objects
  for select to authenticated
  using (bucket_id in ('kyc-documents', 'deposit-proofs', 'handover-documents') and public.is_admin());
create policy "storage: admins upload handover docs" on storage.objects
  for insert to authenticated with check (bucket_id = 'handover-documents' and public.is_admin());

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on function public.qualifying_deposit(uuid, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.storage_object_exists(text, text) from public, anon, authenticated;
revoke all on function public.deposit_withdrawal_impact(uuid) from public, anon, authenticated;
revoke all on function public.guard_deposit_update() from public, anon, authenticated;
revoke execute on function public.submit_kyc(text, text, text) from anon;
revoke execute on function public.admin_review_kyc(uuid, text, text) from anon;
revoke execute on function public.create_deposit(uuid, text, text, text, boolean) from anon;
revoke execute on function public.get_deposit_withdrawal_impact(uuid) from anon;
revoke execute on function public.request_deposit_withdrawal(uuid, text) from anon;
revoke execute on function public.admin_review_deposit(uuid, text, text) from anon;
revoke execute on function public.admin_complete_refund(uuid, text, text) from anon;
revoke execute on function public.admin_record_handover(uuid, text, date, text, text[], text) from anon;
