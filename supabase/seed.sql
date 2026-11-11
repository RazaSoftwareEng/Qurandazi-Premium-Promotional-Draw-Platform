-- =====================================================================
-- QURANDAZI — seed data (safe to re-run)
-- Each category requires a refundable deposit (deposit_amount) with a
-- lock-in period. A deposit qualifies its category and every lower one.
-- Run AFTER all migrations (including 0005_deposits_kyc).
-- =====================================================================

insert into public.categories (name, slug, tagline, description, reference_amount, deposit_amount, deposit_lock_in_days, sort_order)
values
  ('Grande', 'grande', 'Our flagship promotional tier',
   'Grande campaigns feature our biggest rewards. They require a verified, refundable deposit of PKR 20,000, which also qualifies you for Alto and 125 campaigns.',
   20000, 20000, 30, 1),
  ('Alto', 'alto', 'Elevated everyday rewards',
   'Alto campaigns offer premium rewards throughout the year. They require a verified, refundable deposit of PKR 10,000, which also qualifies you for 125 campaigns.',
   10000, 10000, 30, 2),
  ('125', '125', 'Accessible rewards for everyone',
   'The 125 tier brings frequent, accessible promotional draws. It requires a verified, refundable deposit of PKR 5,000.',
   5000, 5000, 30, 3)
on conflict (slug) do update
  set name = excluded.name, tagline = excluded.tagline, description = excluded.description,
      reference_amount = excluded.reference_amount, deposit_amount = excluded.deposit_amount,
      deposit_lock_in_days = excluded.deposit_lock_in_days, sort_order = excluded.sort_order;

insert into public.campaigns (category_id, title, slug, summary, description, prize_description, rules,
                              participation_instructions, eligibility_summary, start_date, end_date, draw_date,
                              status, is_featured, winners_count)
select c.id, v.title, v.slug, v.summary, v.description, v.prize, v.rules, v.instructions, v.elig,
       now() + v.start_off, now() + v.end_off, now() + v.end_off + interval '2 days', v.status, v.featured, v.winners
from (values
  ('grande', 'Grande Winter Showcase', 'grande-winter-showcase',
   'Our flagship winter campaign with premium rewards for registered members.',
   'Celebrate the season with QURANDAZI. Members with a verified Grande deposit can join this campaign, and one winner will be selected through our transparent, verifiable draw process.',
   'Premium home electronics bundle',
   E'1. One entry per KYC-verified member.\n2. A verified Grande deposit (PKR 20,000) must be active when the campaign closes.\n3. Entries close at the published closing date and time.\n4. Winners are selected by a cryptographically secure, publicly verifiable process.\n5. Results are approved by a Super Admin before publication.\n6. No entry fee is charged. Deposits are refundable under the deposit terms.',
   E'Verify your email, complete your profile, get your CNIC verified, make a Grande deposit, then press "Join Campaign" on this page.',
   'Open to KYC-verified members with an active Grande deposit.',
   interval '-3 days', interval '25 days', 'active', true, 1),
  ('alto', 'Alto Spring Rewards', 'alto-spring-rewards',
   'Elevated seasonal rewards for our community.',
   'Alto Spring Rewards gives every eligible member an equal chance. Join during the campaign window with a verified Alto or Grande deposit.',
   'Three premium gift vouchers',
   E'1. One entry per KYC-verified member.\n2. Requires an active Alto (PKR 10,000) or higher deposit at closing.\n3. Three winners will be selected.',
   E'Get KYC verified, make an Alto or Grande deposit and press "Join Campaign".',
   'Open to KYC-verified members with an active Alto or higher deposit.',
   interval '-1 day', interval '40 days', 'active', true, 3),
  ('125', '125 Community Draw', '125-community-draw',
   'An accessible community campaign opening soon.',
   'The 125 Community Draw is designed to be frequent and accessible. Mark your calendar — entries open soon.',
   'Five smart accessories bundles',
   E'1. One entry per KYC-verified member.\n2. Requires an active 125 (PKR 5,000) or higher deposit at closing.\n3. Five winners will be selected.',
   E'Return when the campaign opens and press "Join Campaign".',
   'Open to KYC-verified members with an active deposit.',
   interval '10 days', interval '45 days', 'upcoming', false, 5)
) as v(cat_slug, title, slug, summary, description, prize, rules, instructions, elig, start_off, end_off, status, featured, winners)
join public.categories c on c.slug = v.cat_slug
on conflict (slug) do nothing;

insert into public.eligibility_rules (campaign_id, rule_type, description)
select id, 'email_verified', 'A verified email address is required' from public.campaigns where slug in ('grande-winter-showcase', 'alto-spring-rewards')
on conflict (campaign_id, rule_type) do nothing;
insert into public.eligibility_rules (campaign_id, rule_type, description)
select id, 'profile_complete', 'Full name, phone number and address are required' from public.campaigns where slug = 'grande-winter-showcase'
on conflict (campaign_id, rule_type) do nothing;

insert into public.site_settings (key, value, description) values
  ('branding', '{"site_name":"QURANDAZI","tagline":"Your Chance. Your Moment.","logo_url":null}', 'Website branding'),
  ('contact', '{"email":"support@qurandazi.example","phone":"+92 300 0000000","address":"Karachi, Pakistan","hours":"Mon–Fri, 10:00–18:00 PKT"}', 'Public contact information'),
  ('homepage', '{"hero_title":"Your Chance. Your Moment.","hero_subtitle":"Promotional campaigns with transparent, independently verifiable draws. Your deposit is refundable, never a fee.","announcement":""}', 'Homepage content'),
  ('social', '{"facebook":"","instagram":"","x":"","youtube":""}', 'Social media links')
on conflict (key) do nothing;
