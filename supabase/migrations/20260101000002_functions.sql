-- =====================================================================
-- QURANDAZI — 0002 Functions, triggers and server-side business logic
-- All privileged operations run here (SECURITY DEFINER) and verify the
-- caller's role server-side. The frontend never decides authorization.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select r.role
  from public.user_roles r
  join public.profiles p on p.id = r.user_id
  where r.user_id = auth.uid() and p.status = 'active';
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'super_admin'), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() = 'super_admin', false);
$$;

-- ---------------------------------------------------------------------
-- Audit helpers
-- ---------------------------------------------------------------------
create or replace function public.log_admin_action(
  p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text; v_email text;
begin
  select full_name, email into v_name, v_email from public.profiles where id = auth.uid();
  insert into public.admin_activity_logs (admin_id, admin_name, admin_email, action, entity_type, entity_id, details)
  values (auth.uid(), v_name, v_email, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke all on function public.log_admin_action(text, text, text, jsonb) from public, anon, authenticated;

-- Client-callable logger for admin-side events such as CSV exports.
create or replace function public.log_client_admin_event(p_action text, p_entity_type text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_\.]{3,60}$' then raise exception 'Invalid action name'; end if;
  perform public.log_admin_action(p_action, left(coalesce(p_entity_type, 'system'), 40), null, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Generic row-change audit trigger. Records changes made by administrators.
-- tg_argv[0] = name of the key column (defaults to 'id').
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := coalesce(tg_argv[0], 'id');
  v_old jsonb; v_new jsonb; v_diff jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    perform public.log_admin_action(tg_table_name || '.create', tg_table_name, v_new ->> v_key,
      jsonb_build_object('record', v_new));
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value)), '{}'::jsonb)
      into v_diff
      from jsonb_each(v_new) n
     where n.key not in ('updated_at', 'entries_count', 'last_sign_in_at')
       and (v_old -> n.key) is distinct from n.value;
    if v_diff = '{}'::jsonb then return null; end if;
    perform public.log_admin_action(tg_table_name || '.update', tg_table_name, v_new ->> v_key,
      jsonb_build_object('changes', v_diff));
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    perform public.log_admin_action(tg_table_name || '.delete', tg_table_name, v_old ->> v_key,
      jsonb_build_object('record', v_old));
  end if;
  return null;
end;
$$;

create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.audit_row_change('id');
create trigger audit_campaigns after insert or update or delete on public.campaigns
  for each row execute function public.audit_row_change('id');
create trigger audit_eligibility_rules after insert or update or delete on public.eligibility_rules
  for each row execute function public.audit_row_change('id');
create trigger audit_site_settings after insert or update or delete on public.site_settings
  for each row execute function public.audit_row_change('key');
create trigger audit_profiles after update on public.profiles
  for each row execute function public.audit_row_change('id');
create trigger audit_contact_messages after update or delete on public.contact_messages
  for each row execute function public.audit_row_change('id');

-- Append-only enforcement
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Records in % are immutable (% rejected)', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

create trigger immutable_admin_logs before update or delete on public.admin_activity_logs
  for each row execute function public.prevent_mutation();
create trigger immutable_draw_snapshots before update or delete on public.draw_snapshots
  for each row execute function public.prevent_mutation();
create trigger immutable_draw_results before update or delete on public.draw_results
  for each row execute function public.prevent_mutation();
create trigger immutable_draw_secrets before update or delete on public.draw_secrets
  for each row execute function public.prevent_mutation();

-- ---------------------------------------------------------------------
-- Auth sync: create profile + default role on sign-up
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

  insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), new.email, v_phone, new.email_confirmed_at)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
     set email = new.email,
         email_confirmed_at = new.email_confirmed_at,
         last_sign_in_at = new.last_sign_in_at
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, email_confirmed_at, last_sign_in_at on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------
-- Profile guard: users may edit only personal fields on their own row.
-- Administrators may change status, with safeguards.
-- ---------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_target_role public.app_role;
begin
  -- System context (auth sync triggers, service role)
  if auth.uid() is null then
    return new;
  end if;

  -- Identity / auth-mirrored fields are never editable through the API
  new.id := old.id;
  new.email := old.email;
  new.email_confirmed_at := old.email_confirmed_at;
  new.last_sign_in_at := old.last_sign_in_at;
  new.created_at := old.created_at;

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
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------
-- Notifications guard: owners may only mark as read/unread
-- ---------------------------------------------------------------------
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  new.type := old.type;
  new.title := old.title;
  new.body := old.body;
  new.link := old.link;
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ---------------------------------------------------------------------
-- Campaign guards
-- ---------------------------------------------------------------------
create or replace function public.guard_campaign_update()
returns trigger
language plpgsql
as $$
begin
  -- entries_count is maintained exclusively by the entries trigger
  if pg_trigger_depth() <= 1 then
    new.entries_count := old.entries_count;
  end if;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  return new;
end;
$$;
create trigger campaigns_guard before update on public.campaigns
  for each row execute function public.guard_campaign_update();

create or replace function public.guard_campaign_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.entries where campaign_id = old.id) then
    raise exception 'This campaign already has entries. Cancel or deactivate it instead of deleting.'
      using errcode = '23503';
  end if;
  if exists (select 1 from public.draws where campaign_id = old.id) then
    raise exception 'This campaign has draw records. Cancel it instead of deleting.'
      using errcode = '23503';
  end if;
  return old;
end;
$$;
create trigger campaigns_delete_guard before delete on public.campaigns
  for each row execute function public.guard_campaign_delete();

create or replace function public.set_campaign_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := auth.uid();
  new.entries_count := 0;
  return new;
end;
$$;
create trigger campaigns_created_by before insert on public.campaigns
  for each row execute function public.set_campaign_created_by();

-- Maintain campaigns.entries_count
create or replace function public.sync_campaign_entries_count()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.campaigns set entries_count = entries_count + 1 where id = new.campaign_id;
  elsif tg_op = 'DELETE' then
    update public.campaigns set entries_count = greatest(entries_count - 1, 0) where id = old.campaign_id;
  end if;
  return null;
end;
$$;
create trigger entries_count_sync after insert or delete on public.entries
  for each row execute function public.sync_campaign_entries_count();

-- ---------------------------------------------------------------------
-- Draw guard: key integrity fields can never change once set
-- ---------------------------------------------------------------------
create or replace function public.guard_draw_update()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('published', 'cancelled') then
    raise exception 'This draw is finalized and cannot be modified' using errcode = '42501';
  end if;
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'A draw cannot be moved to another campaign' using errcode = '42501';
  end if;
  if old.snapshot_hash is not null and (
       new.snapshot_hash is distinct from old.snapshot_hash or
       new.seed_commitment is distinct from old.seed_commitment or
       new.entry_count is distinct from old.entry_count or
       new.winners_count is distinct from old.winners_count or
       new.scheduled_at is distinct from old.scheduled_at) then
    raise exception 'Frozen draw parameters are immutable' using errcode = '42501';
  end if;
  if old.seed_reveal is not null and new.seed_reveal is distinct from old.seed_reveal then
    raise exception 'The revealed seed is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger draws_guard before update on public.draws
  for each row execute function public.guard_draw_update();

-- ---------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------
create or replace function public.mask_display_name(p_name text)
returns text
language plpgsql immutable
as $$
declare
  v_parts text[];
begin
  v_parts := regexp_split_to_array(trim(coalesce(p_name, '')), '\s+');
  if v_parts is null or array_length(v_parts, 1) is null or v_parts[1] = '' then
    return 'Participant';
  end if;
  if array_length(v_parts, 1) = 1 then
    return initcap(v_parts[1]);
  end if;
  return initcap(v_parts[1]) || ' ' || upper(left(v_parts[array_length(v_parts, 1)], 1)) || '.';
end;
$$;

-- ---------------------------------------------------------------------
-- Eligibility
-- ---------------------------------------------------------------------
create or replace function public.evaluate_eligibility(p_user_id uuid, p_campaign_id uuid)
returns text[]
language plpgsql stable security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_role public.app_role;
  v_campaign public.campaigns;
  v_rule record;
  v_reasons text[] := '{}';
  v_cities text[];
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

  for v_rule in select * from public.eligibility_rules where campaign_id = p_campaign_id loop
    case v_rule.rule_type
      when 'email_verified' then
        if v_profile.email_confirmed_at is null then
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
begin
  if auth.uid() is null then
    return jsonb_build_object('authenticated', false, 'eligible', false, 'already_joined', false, 'reasons', '[]'::jsonb);
  end if;

  select * into v_entry from public.entries where campaign_id = p_campaign_id and user_id = auth.uid();
  v_reasons := public.evaluate_eligibility(auth.uid(), p_campaign_id);

  return jsonb_build_object(
    'authenticated', true,
    'already_joined', v_entry.id is not null,
    'entry_reference', v_entry.reference,
    'entry_status', v_entry.status,
    'eligible', v_entry.id is null and coalesce(array_length(v_reasons, 1), 0) = 0,
    'reasons', to_jsonb(coalesce(v_reasons, '{}'))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Free entry
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
begin
  if v_uid is null then
    raise exception 'Please sign in to join this campaign' using errcode = '28000';
  end if;

  -- Shared lock: serialises with freeze_draw (which takes FOR UPDATE)
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

  loop
    v_try := v_try + 1;
    v_ref := 'QZ-' || to_char(now() at time zone 'utc', 'YYMM') || '-' || upper(encode(gen_random_bytes(4), 'hex'));
    begin
      insert into public.entries (reference, campaign_id, user_id)
      values (v_ref, p_campaign_id, v_uid)
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
          format('Your free entry %s for "%s" has been recorded. Good luck!', v_entry.reference, v_campaign.title),
          '/dashboard/entries');

  return jsonb_build_object('id', v_entry.id, 'reference', v_entry.reference,
                            'campaign_id', v_entry.campaign_id, 'created_at', v_entry.created_at);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: entry verification
-- ---------------------------------------------------------------------
create or replace function public.admin_set_entry_status(p_entry_id uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_entry public.entries;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_status not in ('confirmed', 'verified', 'disqualified') then raise exception 'Invalid status'; end if;
  if p_status = 'disqualified' and coalesce(trim(p_note), '') = '' then
    raise exception 'A reason is required when disqualifying an entry';
  end if;

  select * into v_entry from public.entries where id = p_entry_id for update;
  if v_entry.id is null then raise exception 'Entry not found'; end if;

  if exists (select 1 from public.draws where campaign_id = v_entry.campaign_id and status not in ('scheduled', 'cancelled')) then
    raise exception 'Entries for this campaign are frozen and can no longer be changed' using errcode = '42501';
  end if;

  update public.entries
     set status = p_status, status_note = left(p_note, 500), verified_by = auth.uid(), verified_at = now()
   where id = p_entry_id;

  perform public.log_admin_action('entry.' || p_status, 'entries', p_entry_id::text,
    jsonb_build_object('reference', v_entry.reference, 'from', v_entry.status, 'to', p_status, 'note', p_note));

  if p_status = 'disqualified' then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_entry.user_id, 'entry', 'Entry status updated',
            format('Your entry %s was marked ineligible. Reason: %s', v_entry.reference, p_note), '/dashboard/entries');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: role management (Super Admin only)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_old public.app_role;
begin
  if not public.is_super_admin() then raise exception 'Only a Super Admin can change roles' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role' using errcode = '42501'; end if;

  select role into v_old from public.user_roles where user_id = p_user_id for update;
  if v_old is null then raise exception 'User not found'; end if;
  if v_old = p_role then return; end if;

  update public.user_roles set role = p_role, assigned_by = auth.uid(), assigned_at = now() where user_id = p_user_id;
  perform public.log_admin_action('user.role_change', 'profiles', p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

-- ---------------------------------------------------------------------
-- Draw engine
--
-- Commit–reveal, reproducible winner selection (algorithm QZ-SHA256-v1):
--  1. FREEZE   — eligible entries are copied to an immutable snapshot,
--                ordered by (created_at, id) and numbered 1..N.
--                snapshot_hash = SHA256( "1:REF\n2:REF\n...N:REF" )
--                A 256-bit seed is drawn from a CSPRNG (gen_random_bytes)
--                and only its commitment SHA256(seed_hex) is published.
--  2. EXECUTE  — for rank k = 1..W:
--                  h_k   = SHA256( seed_hex || ':' || snapshot_hash || ':' || k )
--                  idx_k = int(first 15 hex chars of h_k) mod remaining_pool
--                  winner = remaining_pool[idx_k]  (pool kept in ascending position order)
--                The seed is revealed. Anyone can verify SHA256(seed) = commitment
--                and recompute every winner.
--  3. APPROVE  — Super Admin approval (a different Super Admin when one exists).
--  4. PUBLISH  — results become public; participants are notified.
-- Results and snapshots are append-only and a campaign can have only one
-- live draw, so a result cannot be silently re-rolled.
-- ---------------------------------------------------------------------
create or replace function public.schedule_draw(
  p_campaign_id uuid, p_title text, p_scheduled_at timestamptz, p_winners_count int, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign public.campaigns;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if v_campaign.id is null then raise exception 'Campaign not found'; end if;
  if v_campaign.status in ('draft', 'cancelled', 'completed') then
    raise exception 'Draws cannot be scheduled for % campaigns', v_campaign.status;
  end if;
  if p_scheduled_at < v_campaign.end_date then
    raise exception 'The draw must be scheduled at or after the campaign closing date (%)', v_campaign.end_date;
  end if;
  if coalesce(p_winners_count, 0) < 1 or p_winners_count > 100 then raise exception 'Winners must be between 1 and 100'; end if;
  if char_length(coalesce(trim(p_title), '')) < 3 then raise exception 'Title is required'; end if;

  begin
    insert into public.draws (campaign_id, title, scheduled_at, winners_count, notes, created_by)
    values (p_campaign_id, trim(p_title), p_scheduled_at, p_winners_count, p_notes, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'This campaign already has an active draw' using errcode = '23505';
  end;

  update public.campaigns set draw_date = p_scheduled_at where id = p_campaign_id;
  perform public.log_admin_action('draw.schedule', 'draws', v_id::text,
    jsonb_build_object('campaign_id', p_campaign_id, 'scheduled_at', p_scheduled_at, 'winners_count', p_winners_count));
  return v_id;
end;
$$;

create or replace function public.update_draw(
  p_draw_id uuid, p_title text, p_scheduled_at timestamptz, p_winners_count int, p_notes text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_draw public.draws;
  v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into v_draw from public.draws where id = p_draw_id for update;
  if v_draw.id is null then raise exception 'Draw not found'; end if;
  if v_draw.status <> 'scheduled' then raise exception 'Only scheduled draws can be edited'; end if;
  select end_date into v_end from public.campaigns where id = v_draw.campaign_id;
  if p_scheduled_at < v_end then raise exception 'The draw must be scheduled at or after the campaign closing date'; end if;
  if coalesce(p_winners_count, 0) < 1 or p_winners_count > 100 then raise exception 'Winners must be between 1 and 100'; end if;

  update public.draws set title = trim(p_title), scheduled_at = p_scheduled_at,
         winners_count = p_winners_count, notes = p_notes where id = p_draw_id;
  update public.campaigns set draw_date = p_scheduled_at where id = v_draw.campaign_id;
  perform public.log_admin_action('draw.update', 'draws', p_draw_id::text,
    jsonb_build_object('title', p_title, 'scheduled_at', p_scheduled_at, 'winners_count', p_winners_count));
end;
$$;

create or replace function public.freeze_draw(p_draw_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_draw public.draws;
  v_campaign public.campaigns;
  v_count int;
  v_hash text;
  v_seed text;
  v_commit text;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;

  select * into v_draw from public.draws where id = p_draw_id for update;
  if v_draw.id is null then raise exception 'Draw not found'; end if;
  if v_draw.status <> 'scheduled' then raise exception 'Only scheduled draws can be frozen'; end if;

  select * into v_campaign from public.campaigns where id = v_draw.campaign_id for update;
  if now() < v_campaign.end_date then
    raise exception 'Entries can be frozen only after the campaign closes (%)', v_campaign.end_date;
  end if;

  insert into public.draw_snapshots (draw_id, position, entry_id, entry_reference, user_id, entry_created_at)
  select v_draw.id,
         row_number() over (order by e.created_at, e.id),
         e.id, e.reference, e.user_id, e.created_at
    from public.entries e
    join public.profiles p on p.id = e.user_id
   where e.campaign_id = v_campaign.id
     and e.status in ('confirmed', 'verified')
     and e.created_at <= v_campaign.end_date
     and p.status = 'active';
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'There are no eligible entries to freeze';
  end if;

  select encode(digest(string_agg(s.position::text || ':' || s.entry_reference, E'\n' order by s.position), 'sha256'), 'hex')
    into v_hash
    from public.draw_snapshots s where s.draw_id = v_draw.id;

  v_seed := encode(gen_random_bytes(32), 'hex');
  v_commit := encode(digest(v_seed, 'sha256'), 'hex');
  insert into public.draw_secrets (draw_id, seed) values (v_draw.id, v_seed);

  update public.draws
     set status = 'frozen', entry_count = v_count, winners_count = least(v_draw.winners_count, v_count),
         snapshot_hash = v_hash, seed_commitment = v_commit, frozen_by = auth.uid(), frozen_at = now()
   where id = v_draw.id;

  update public.campaigns set status = 'closed' where id = v_campaign.id and status in ('active', 'upcoming');

  perform public.log_admin_action('draw.freeze', 'draws', v_draw.id::text,
    jsonb_build_object('entry_count', v_count, 'snapshot_hash', v_hash, 'seed_commitment', v_commit));

  return jsonb_build_object('entry_count', v_count, 'snapshot_hash', v_hash, 'seed_commitment', v_commit);
end;
$$;

create or replace function public.execute_draw(p_draw_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_draw public.draws;
  v_seed text;
  v_positions int[];
  v_remaining int;
  v_hash text;
  v_idx bigint;
  v_pos int;
  v_snap public.draw_snapshots;
  v_name text;
  k int;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;

  select * into v_draw from public.draws where id = p_draw_id for update;
  if v_draw.id is null then raise exception 'Draw not found'; end if;
  if v_draw.status <> 'frozen' then raise exception 'Only frozen draws can be executed'; end if;
  if now() < v_draw.scheduled_at then
    raise exception 'This draw is scheduled for %. It cannot be executed early.', v_draw.scheduled_at;
  end if;
  if exists (select 1 from public.draw_results where draw_id = p_draw_id) then
    raise exception 'Results already exist for this draw';
  end if;

  select seed into v_seed from public.draw_secrets where draw_id = p_draw_id;
  if v_seed is null or encode(digest(v_seed, 'sha256'), 'hex') <> v_draw.seed_commitment then
    raise exception 'Seed commitment verification failed';
  end if;

  select array_agg(position order by position) into v_positions
    from public.draw_snapshots where draw_id = p_draw_id;

  for k in 1 .. v_draw.winners_count loop
    v_remaining := coalesce(array_length(v_positions, 1), 0);
    exit when v_remaining = 0;

    v_hash := encode(digest(v_seed || ':' || v_draw.snapshot_hash || ':' || k::text, 'sha256'), 'hex');
    v_idx := (('x' || lpad(substr(v_hash, 1, 15), 16, '0'))::bit(64)::bigint) % v_remaining;
    v_pos := v_positions[(v_idx + 1)::int];
    v_positions := array_remove(v_positions, v_pos);

    select * into v_snap from public.draw_snapshots where draw_id = p_draw_id and position = v_pos;
    select full_name into v_name from public.profiles where id = v_snap.user_id;

    insert into public.draw_results (draw_id, campaign_id, rank, snapshot_position, entry_id, entry_reference,
                                     user_id, winner_display_name, derivation, pool_size)
    values (p_draw_id, v_draw.campaign_id, k, v_pos, v_snap.entry_id, v_snap.entry_reference,
            v_snap.user_id, public.mask_display_name(v_name), v_hash, v_remaining);
  end loop;

  update public.draws set status = 'drawn', seed_reveal = v_seed, executed_by = auth.uid(), executed_at = now()
   where id = p_draw_id;

  perform public.log_admin_action('draw.execute', 'draws', p_draw_id::text,
    jsonb_build_object('winners', v_draw.winners_count, 'seed_reveal', v_seed));

  return jsonb_build_object('status', 'drawn', 'seed', v_seed);
end;
$$;

create or replace function public.approve_draw(p_draw_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_draw public.draws;
begin
  if not public.is_super_admin() then raise exception 'Only a Super Admin can approve results' using errcode = '42501'; end if;
  select * into v_draw from public.draws where id = p_draw_id for update;
  if v_draw.id is null then raise exception 'Draw not found'; end if;
  if v_draw.status <> 'drawn' then raise exception 'Only executed draws can be approved'; end if;

  if v_draw.executed_by = auth.uid() and exists (
       select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
        where r.role = 'super_admin' and p.status = 'active' and r.user_id <> auth.uid()) then
    raise exception 'Results must be approved by a different Super Admin than the one who executed the draw'
      using errcode = '42501';
  end if;

  update public.draws set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_draw_id;
  perform public.log_admin_action('draw.approve', 'draws', p_draw_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.publish_draw(p_draw_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_draw public.draws;
  v_campaign public.campaigns;
begin
  if not public.is_super_admin() then raise exception 'Only a Super Admin can publish results' using errcode = '42501'; end if;
  select * into v_draw from public.draws where id = p_draw_id for update;
  if v_draw.id is null then raise exception 'Draw not found'; end if;
  if v_draw.status <> 'approved' then raise exception 'Only approved draws can be published'; end if;
  select * into v_campaign from public.campaigns where id = v_draw.campaign_id;

  update public.draws set status = 'published', published_by = auth.uid(), published_at = now() where id = p_draw_id;
  update public.campaigns set status = 'completed' where id = v_draw.campaign_id;

  -- Notify winners
  insert into public.notifications (user_id, type, title, body, link)
  select r.user_id, 'winner', 'Congratulations — you are a winner!',
         format('Your entry %s was selected (rank #%s) in "%s". Our team will contact you to arrange your prize.',
                r.entry_reference, r.rank, v_campaign.title),
         '/dashboard/draw-history'
    from public.draw_results r where r.draw_id = p_draw_id;

  -- Notify other participants
  insert into public.notifications (user_id, type, title, body, link)
  select s.user_id, 'result', 'Draw results published',
         format('Results for "%s" are now published. Thank you for participating.', v_campaign.title),
         '/winners'
    from public.draw_snapshots s
   where s.draw_id = p_draw_id
     and not exists (select 1 from public.draw_results r where r.draw_id = p_draw_id and r.user_id = s.user_id);

  insert into public.announcements (title, body, type, audience, campaign_id, link, recipients_count, created_by)
  values (format('Results published: %s', v_campaign.title),
          format('The draw for "%s" has been completed and verified. View the winners and audit trail.', v_campaign.title),
          'result', 'campaign', v_campaign.id, '/winners',
          (select count(*) from public.draw_snapshots where draw_id = p_draw_id), auth.uid());

  perform public.log_admin_action('draw.publish', 'draws', p_draw_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.cancel_draw(p_draw_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_draw public.draws;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_reason), '')) < 5 then raise exception 'Please provide a reason (min. 5 characters)'; end if;
  select * into v_draw from public.draws where id = p_draw_id for update;
  if v_draw.id is null then raise exception 'Draw not found'; end if;
  if v_draw.status not in ('scheduled', 'frozen') then
    raise exception 'Draws that have already been executed cannot be cancelled' using errcode = '42501';
  end if;
  if v_draw.status = 'frozen' and not public.is_super_admin() then
    raise exception 'Only a Super Admin can cancel a frozen draw' using errcode = '42501';
  end if;

  update public.draws set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
         cancel_reason = trim(p_reason) where id = p_draw_id;
  perform public.log_admin_action('draw.cancel', 'draws', p_draw_id::text,
    jsonb_build_object('previous_status', v_draw.status, 'reason', p_reason));
end;
$$;

-- Public, verifiable audit record of a published draw (admins: any draw)
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

-- Public list of published winners (masked names only)
create or replace function public.get_published_winners(p_limit int default 12, p_offset int default 0, p_search text default null)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with base as (
    select r.id, r.draw_id, r.rank, r.entry_reference, r.winner_display_name,
           c.id as campaign_id, c.title as campaign_title, c.slug as campaign_slug, c.prize_description,
           c.banner_url, cat.name as category_name, d.published_at, d.entry_count
      from public.draw_results r
      join public.draws d on d.id = r.draw_id and d.status = 'published'
      join public.campaigns c on c.id = r.campaign_id
      left join public.categories cat on cat.id = c.category_id
     where p_search is null or p_search = ''
        or c.title ilike '%' || p_search || '%'
        or r.entry_reference ilike '%' || p_search || '%'
        or r.winner_display_name ilike '%' || p_search || '%'
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(to_jsonb(b) order by b.published_at desc, b.rank)
                        from (select * from base order by published_at desc, rank
                              limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) b), '[]'::jsonb)
  );
$$;

-- The signed-in user's participation & results history
create or replace function public.get_my_draw_history()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x.entry_created_at desc), '[]'::jsonb)
  from (
    select e.id as entry_id, e.reference, e.status as entry_status, e.created_at as entry_created_at,
           c.id as campaign_id, c.title as campaign_title, c.slug as campaign_slug, c.status as campaign_status,
           c.end_date, d.id as draw_id, d.title as draw_title, d.scheduled_at as draw_date,
           case when d.status = 'published' then 'published'
                when d.status is null then 'not_scheduled'
                else 'pending' end as result_status,
           d.published_at,
           (d.status = 'published' and r.id is not null) as won,
           case when d.status = 'published' then r.rank end as rank,
           (select count(*) from public.draw_results rr where rr.draw_id = d.id and d.status = 'published') as winners_published
      from public.entries e
      join public.campaigns c on c.id = e.campaign_id
      left join public.draws d on d.campaign_id = c.id and d.status <> 'cancelled'
      left join public.draw_results r on r.draw_id = d.id and r.entry_id = e.id
     where e.user_id = auth.uid()
  ) x;
$$;

-- ---------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------
create or replace function public.send_announcement(
  p_title text, p_body text, p_type text default 'announcement', p_audience text default 'all',
  p_campaign_id uuid default null, p_link text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_title), '')) < 3 then raise exception 'Title must be at least 3 characters'; end if;
  if char_length(coalesce(trim(p_body), '')) < 1 then raise exception 'Message is required'; end if;
  if p_type not in ('announcement', 'campaign', 'result') then raise exception 'Invalid type'; end if;
  if p_audience not in ('all', 'campaign') then raise exception 'Invalid audience'; end if;
  if p_audience = 'campaign' and p_campaign_id is null then raise exception 'Select a campaign'; end if;
  if p_link is not null and p_link <> '' and p_link !~ '^/' then raise exception 'Links must be internal paths starting with /'; end if;

  insert into public.announcements (title, body, type, audience, campaign_id, link, created_by)
  values (trim(p_title), trim(p_body), p_type, p_audience, p_campaign_id, nullif(p_link, ''), auth.uid())
  returning id into v_id;

  if p_audience = 'all' then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, p_type, trim(p_title), trim(p_body), nullif(p_link, '')
      from public.profiles p
      join public.user_roles r on r.user_id = p.id
     where p.status = 'active' and r.role = 'user';
  else
    insert into public.notifications (user_id, type, title, body, link)
    select distinct e.user_id, p_type, trim(p_title), trim(p_body), nullif(p_link, '')
      from public.entries e join public.profiles p on p.id = e.user_id
     where e.campaign_id = p_campaign_id and p.status = 'active';
  end if;
  get diagnostics v_count = row_count;

  update public.announcements set recipients_count = v_count where id = v_id;
  perform public.log_admin_action('announcement.send', 'announcements', v_id::text,
    jsonb_build_object('title', p_title, 'audience', p_audience, 'campaign_id', p_campaign_id, 'recipients', v_count));
  return jsonb_build_object('id', v_id, 'recipients', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- Analytics
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
    'unread_messages', (select count(*) from public.contact_messages where status = 'new')
  );
end;
$$;

create or replace function public.admin_timeseries(p_days int default 30)
returns table (day date, registrations bigint, entries bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
    select d::date,
           (select count(*) from public.profiles p where p.created_at::date = d::date),
           (select count(*) from public.entries e where e.created_at::date = d::date)
      from generate_series(current_date - (least(greatest(p_days, 7), 180) - 1), current_date, interval '1 day') d
     order by 1;
end;
$$;

create or replace function public.get_public_stats()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'campaigns', (select count(*) from public.campaigns where status <> 'draft'),
    'entries', (select count(*) from public.entries),
    'draws', (select count(*) from public.draws where status = 'published'),
    'winners', (select count(*) from public.draw_results r join public.draws d on d.id = r.draw_id where d.status = 'published'),
    'members', (select count(*) from public.profiles)
  );
$$;

-- Internal functions should not be callable from the API
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_updated() from public, anon, authenticated;
revoke all on function public.sync_campaign_entries_count() from public, anon, authenticated;
revoke execute on function public.join_campaign(uuid) from anon;
revoke execute on function public.admin_set_entry_status(uuid, text, text) from anon;
revoke execute on function public.admin_set_user_role(uuid, public.app_role) from anon;
revoke execute on function public.schedule_draw(uuid, text, timestamptz, int, text) from anon;
revoke execute on function public.update_draw(uuid, text, timestamptz, int, text) from anon;
revoke execute on function public.freeze_draw(uuid) from anon;
revoke execute on function public.execute_draw(uuid) from anon;
revoke execute on function public.approve_draw(uuid) from anon;
revoke execute on function public.publish_draw(uuid) from anon;
revoke execute on function public.cancel_draw(uuid, text) from anon;
revoke execute on function public.send_announcement(text, text, text, text, uuid, text) from anon;
revoke execute on function public.admin_dashboard_stats() from anon;
revoke execute on function public.admin_timeseries(int) from anon;
revoke execute on function public.log_client_admin_event(text, text, jsonb) from anon;
