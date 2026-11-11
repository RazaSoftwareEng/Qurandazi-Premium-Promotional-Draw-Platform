-- =====================================================================
-- QURANDAZI — 0003 Row Level Security
-- Every table has RLS enabled. Writes to sensitive tables happen only
-- through SECURITY DEFINER functions that check roles server-side.
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.categories          enable row level security;
alter table public.campaigns           enable row level security;
alter table public.eligibility_rules   enable row level security;
alter table public.entries             enable row level security;
alter table public.draws               enable row level security;
alter table public.draw_secrets        enable row level security;
alter table public.draw_snapshots      enable row level security;
alter table public.draw_results        enable row level security;
alter table public.notifications       enable row level security;
alter table public.announcements       enable row level security;
alter table public.admin_activity_logs enable row level security;
alter table public.site_settings       enable row level security;
alter table public.contact_messages    enable row level security;

-- draw_secrets: no policies at all + revoke grants => never exposed via the API
revoke all on public.draw_secrets from anon, authenticated;

-- ---------------- profiles ----------------
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: admin read all" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin update" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- No insert/delete policies: rows are created by the auth trigger and
-- removed only via the admin-users Edge Function (auth user deletion).

-- ---------------- user_roles ----------------
create policy "roles: read own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "roles: admin read" on public.user_roles
  for select to authenticated using (public.is_admin());
-- No write policies: roles change only via admin_set_user_role().

-- ---------------- categories ----------------
create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "categories: admin insert" on public.categories
  for insert to authenticated with check (public.is_admin());
create policy "categories: admin update" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories: admin delete" on public.categories
  for delete to authenticated using (public.is_admin());

-- ---------------- campaigns ----------------
create policy "campaigns: public read non-draft" on public.campaigns
  for select to anon, authenticated using (status <> 'draft' or public.is_admin());
create policy "campaigns: admin insert" on public.campaigns
  for insert to authenticated with check (public.is_admin());
create policy "campaigns: admin update" on public.campaigns
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "campaigns: admin delete" on public.campaigns
  for delete to authenticated using (public.is_admin());

-- ---------------- eligibility_rules ----------------
create policy "rules: public read" on public.eligibility_rules
  for select to anon, authenticated using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and (c.status <> 'draft' or public.is_admin())));
create policy "rules: admin insert" on public.eligibility_rules
  for insert to authenticated with check (public.is_admin());
create policy "rules: admin update" on public.eligibility_rules
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "rules: admin delete" on public.eligibility_rules
  for delete to authenticated using (public.is_admin());

-- ---------------- entries ----------------
create policy "entries: read own" on public.entries
  for select to authenticated using (user_id = auth.uid());
create policy "entries: admin read" on public.entries
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: join_campaign() / admin_set_entry_status() only.

-- ---------------- draws ----------------
create policy "draws: public read published" on public.draws
  for select to anon, authenticated using (status = 'published' or public.is_admin());
-- No write policies: draw lifecycle functions only.

-- ---------------- draw_snapshots ----------------
create policy "snapshots: admin read" on public.draw_snapshots
  for select to authenticated using (public.is_admin());

-- ---------------- draw_results ----------------
create policy "results: admin read" on public.draw_results
  for select to authenticated using (public.is_admin());
create policy "results: read own published" on public.draw_results
  for select to authenticated using (
    user_id = auth.uid() and exists (select 1 from public.draws d where d.id = draw_id and d.status = 'published'));

-- ---------------- notifications ----------------
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: update own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: delete own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------- announcements ----------------
create policy "announcements: admin read" on public.announcements
  for select to authenticated using (public.is_admin());

-- ---------------- admin_activity_logs ----------------
create policy "logs: admin read" on public.admin_activity_logs
  for select to authenticated using (public.is_admin());

-- ---------------- site_settings ----------------
create policy "settings: public read" on public.site_settings
  for select to anon, authenticated using (true);
create policy "settings: admin insert" on public.site_settings
  for insert to authenticated with check (public.is_admin());
create policy "settings: admin update" on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------- contact_messages ----------------
create policy "contact: anyone can submit" on public.contact_messages
  for insert to anon, authenticated with check (status = 'new');
create policy "contact: admin read" on public.contact_messages
  for select to authenticated using (public.is_admin());
create policy "contact: admin update" on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contact: admin delete" on public.contact_messages
  for delete to authenticated using (public.is_admin());
