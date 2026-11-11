-- =====================================================================
-- QURANDAZI — 0001 Schema
-- Tables, constraints, indexes and timestamp triggers.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('user', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null default '' check (char_length(full_name) <= 120),
  email              text,
  phone              text check (phone is null or phone = '' or phone ~ '^\+?[0-9][0-9 \-]{6,19}$'),
  address            text check (address is null or char_length(address) <= 300),
  city               text check (city is null or char_length(city) <= 80),
  avatar_url         text check (avatar_url is null or char_length(avatar_url) <= 500),
  status             text not null default 'active' check (status in ('active', 'suspended')),
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- user_roles  (exactly one role per user; writable only server-side)
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  role        public.app_role not null default 'user',
  assigned_by uuid,
  assigned_at timestamptz not null default now()
);
create index if not exists user_roles_role_idx on public.user_roles (role);

-- ---------------------------------------------------------------------
-- categories
-- reference_amount is an INFORMATIONAL legacy reference only.
-- It is never an entry fee or participation requirement.
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique check (char_length(name) between 1 and 60),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tagline          text check (tagline is null or char_length(tagline) <= 120),
  description      text check (description is null or char_length(description) <= 2000),
  image_url        text,
  reference_amount numeric(12, 2) check (reference_amount is null or reference_amount >= 0),
  reference_label  text not null default 'Minimum deposit reference',
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists categories_sort_idx on public.categories (sort_order, name);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------
create table if not exists public.campaigns (
  id                         uuid primary key default gen_random_uuid(),
  category_id                uuid references public.categories (id) on delete restrict,
  title                      text not null check (char_length(title) between 3 and 150),
  slug                       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary                    text check (summary is null or char_length(summary) <= 300),
  description                text check (description is null or char_length(description) <= 10000),
  banner_url                 text,
  prize_description          text check (prize_description is null or char_length(prize_description) <= 500),
  rules                      text check (rules is null or char_length(rules) <= 10000),
  participation_instructions text check (participation_instructions is null or char_length(participation_instructions) <= 5000),
  eligibility_summary        text check (eligibility_summary is null or char_length(eligibility_summary) <= 2000),
  start_date                 timestamptz not null,
  end_date                   timestamptz not null,
  draw_date                  timestamptz,
  status                     text not null default 'draft'
                             check (status in ('draft', 'upcoming', 'active', 'closed', 'completed', 'cancelled')),
  is_featured                boolean not null default false,
  winners_count              int not null default 1 check (winners_count between 1 and 100),
  entries_count              int not null default 0,
  created_by                 uuid,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint campaigns_dates_chk check (end_date > start_date),
  constraint campaigns_draw_date_chk check (draw_date is null or draw_date >= end_date)
);
create index if not exists campaigns_status_idx on public.campaigns (status);
create index if not exists campaigns_category_idx on public.campaigns (category_id);
create index if not exists campaigns_dates_idx on public.campaigns (start_date, end_date);
create index if not exists campaigns_featured_idx on public.campaigns (is_featured) where is_featured;
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- eligibility_rules
-- ---------------------------------------------------------------------
create table if not exists public.eligibility_rules (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  rule_type   text not null check (rule_type in (
                'email_verified', 'profile_complete', 'phone_required',
                'min_account_age_days', 'city_in')),
  rule_value  text check (rule_value is null or char_length(rule_value) <= 500),
  description text check (description is null or char_length(description) <= 300),
  created_at  timestamptz not null default now(),
  unique (campaign_id, rule_type)
);
create index if not exists eligibility_rules_campaign_idx on public.eligibility_rules (campaign_id);

-- ---------------------------------------------------------------------
-- entries  (free entries; one per user per campaign)
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'confirmed' check (status in ('confirmed', 'verified', 'disqualified')),
  status_note text check (status_note is null or char_length(status_note) <= 500),
  verified_by uuid,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint entries_one_per_user unique (campaign_id, user_id)
);
create index if not exists entries_user_idx on public.entries (user_id, created_at desc);
create index if not exists entries_campaign_idx on public.entries (campaign_id, created_at);
create index if not exists entries_status_idx on public.entries (status);
create trigger entries_updated_at before update on public.entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- draws  (lifecycle: scheduled -> frozen -> drawn -> approved -> published)
-- ---------------------------------------------------------------------
create table if not exists public.draws (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns (id) on delete restrict,
  title             text not null check (char_length(title) between 3 and 150),
  scheduled_at      timestamptz not null,
  winners_count     int not null default 1 check (winners_count between 1 and 100),
  status            text not null default 'scheduled'
                    check (status in ('scheduled', 'frozen', 'drawn', 'approved', 'published', 'cancelled')),
  notes             text check (notes is null or char_length(notes) <= 2000),
  algorithm_version text not null default 'QZ-SHA256-v1',
  entry_count       int,
  snapshot_hash     text,
  seed_commitment   text,
  seed_reveal       text,
  created_by        uuid,
  frozen_by         uuid,
  frozen_at         timestamptz,
  executed_by       uuid,
  executed_at       timestamptz,
  approved_by       uuid,
  approved_at       timestamptz,
  published_by      uuid,
  published_at      timestamptz,
  cancelled_by      uuid,
  cancelled_at      timestamptz,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Only one live (non-cancelled) draw per campaign
create unique index if not exists draws_one_live_per_campaign
  on public.draws (campaign_id) where status <> 'cancelled';
create index if not exists draws_status_idx on public.draws (status);
create index if not exists draws_scheduled_idx on public.draws (scheduled_at);
create trigger draws_updated_at before update on public.draws
  for each row execute function public.set_updated_at();

-- Secret seed, committed at freeze time. No RLS policies => unreadable via API.
create table if not exists public.draw_secrets (
  draw_id    uuid primary key references public.draws (id) on delete restrict,
  seed       text not null,
  created_at timestamptz not null default now()
);

-- Immutable eligible-entry snapshot (no FKs to mutable data on purpose)
create table if not exists public.draw_snapshots (
  id               bigint generated always as identity primary key,
  draw_id          uuid not null references public.draws (id) on delete restrict,
  position         int not null check (position >= 1),
  entry_id         uuid not null,
  entry_reference  text not null,
  user_id          uuid not null,
  entry_created_at timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (draw_id, position),
  unique (draw_id, entry_id)
);

-- Immutable draw results (one row per winner)
create table if not exists public.draw_results (
  id                  uuid primary key default gen_random_uuid(),
  draw_id             uuid not null references public.draws (id) on delete restrict,
  campaign_id         uuid not null,
  rank                int not null check (rank >= 1),
  snapshot_position   int not null,
  entry_id            uuid not null,
  entry_reference     text not null,
  user_id             uuid not null,
  winner_display_name text not null,
  derivation          text not null,
  pool_size           int not null,
  created_at          timestamptz not null default now(),
  unique (draw_id, rank),
  unique (draw_id, entry_id)
);
create index if not exists draw_results_draw_idx on public.draw_results (draw_id);
create index if not exists draw_results_user_idx on public.draw_results (user_id);

-- ---------------------------------------------------------------------
-- notifications (per user) & announcements (broadcasts)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null default 'system'
             check (type in ('announcement', 'campaign', 'entry', 'winner', 'result', 'system')),
  title      text not null check (char_length(title) between 1 and 160),
  body       text check (body is null or char_length(body) <= 4000),
  link       text check (link is null or char_length(link) <= 300),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table if not exists public.announcements (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 3 and 160),
  body             text not null check (char_length(body) between 1 and 4000),
  type             text not null default 'announcement' check (type in ('announcement', 'campaign', 'result')),
  audience         text not null default 'all' check (audience in ('all', 'campaign')),
  campaign_id      uuid references public.campaigns (id) on delete set null,
  link             text,
  recipients_count int not null default 0,
  created_by       uuid,
  created_at       timestamptz not null default now()
);
create index if not exists announcements_created_idx on public.announcements (created_at desc);

-- ---------------------------------------------------------------------
-- admin_activity_logs (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.admin_activity_logs (
  id          bigint generated always as identity primary key,
  admin_id    uuid,
  admin_name  text,
  admin_email text,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_logs_created_idx on public.admin_activity_logs (created_at desc);
create index if not exists admin_logs_admin_idx on public.admin_activity_logs (admin_id);
create index if not exists admin_logs_entity_idx on public.admin_activity_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- site_settings (key/value)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  value       jsonb not null default '{}'::jsonb,
  description text,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- contact_messages (public contact form inbox)
-- ---------------------------------------------------------------------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  subject    text not null check (char_length(subject) between 2 and 200),
  message    text not null check (char_length(message) between 10 and 5000),
  status     text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
