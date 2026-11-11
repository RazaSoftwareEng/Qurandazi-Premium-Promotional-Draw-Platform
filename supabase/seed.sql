-- =====================================================================
-- QURANDAZI — seed data (safe to re-run)
-- Reference amounts are INFORMATIONAL legacy references only.
-- Participation in every campaign is free.
-- =====================================================================

insert into public.categories (name, slug, tagline, description, reference_amount, sort_order)
values
  ('Grande', 'grande', 'Our flagship promotional tier',
   'Grande campaigns feature our most significant promotional rewards. The reference amount is a legacy informational label only — participation is always free.',
   20000, 1),
  ('Alto', 'alto', 'Elevated everyday rewards',
   'Alto campaigns offer premium rewards throughout the year. The reference amount is a legacy informational label only — participation is always free.',
   10000, 2),
  ('125', '125', 'Accessible rewards for everyone',
   'The 125 tier brings frequent, accessible promotional draws. The reference amount is a legacy informational label only — participation is always free.',
   5000, 3)
on conflict (slug) do update
  set name = excluded.name, tagline = excluded.tagline, description = excluded.description,
      reference_amount = excluded.reference_amount, sort_order = excluded.sort_order;

insert into public.campaigns (category_id, title, slug, summary, description, prize_description, rules,
                              participation_instructions, eligibility_summary, start_date, end_date, draw_date,
                              status, is_featured, winners_count)
select c.id, v.title, v.slug, v.summary, v.description, v.prize, v.rules, v.instructions, v.elig,
       now() + v.start_off, now() + v.end_off, now() + v.end_off + interval '2 days', v.status, v.featured, v.winners
from (values
  ('grande', 'Grande Winter Showcase', 'grande-winter-showcase',
   'Our flagship winter campaign with premium rewards for registered members.',
   'Celebrate the season with QURANDAZI. Registered members can join this campaign for free and one winner will be selected through our transparent, verifiable draw process.',
   'Premium home electronics bundle',
   E'1. One free entry per registered member.\n2. Entries close at the published closing date and time.\n3. Winners are selected by a cryptographically secure, publicly verifiable process.\n4. Results are approved by a Super Admin before publication.\n5. No purchase, deposit or payment is required to participate.',
   E'Create a free account, verify your email, complete your profile, then press "Join Campaign" on this page.',
   'Open to registered members with a verified email and a complete profile.',
   interval '-3 days', interval '25 days', 'active', true, 1),
  ('alto', 'Alto Spring Rewards', 'alto-spring-rewards',
   'Elevated seasonal rewards for our community — free to enter.',
   'Alto Spring Rewards gives every registered member an equal chance. Join for free during the campaign window.',
   'Three premium gift vouchers',
   E'1. One free entry per registered member.\n2. Three winners will be selected.\n3. No purchase or payment is required.',
   E'Sign in, verify your email and press "Join Campaign".',
   'Open to registered members with a verified email address.',
   interval '-1 day', interval '40 days', 'active', true, 3),
  ('125', '125 Community Draw', '125-community-draw',
   'An accessible community campaign opening soon.',
   'The 125 Community Draw is designed to be frequent and accessible. Mark your calendar — entries open soon.',
   'Five smart accessories bundles',
   E'1. One free entry per registered member.\n2. Five winners will be selected.\n3. No purchase or payment is required.',
   E'Return when the campaign opens and press "Join Campaign".',
   'Open to all registered members in good standing.',
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
  ('homepage', '{"hero_title":"Your Chance. Your Moment.","hero_subtitle":"Free-entry promotional campaigns with transparent, independently verifiable draws. No purchase. No deposit. Just your moment.","announcement":""}', 'Homepage content'),
  ('social', '{"facebook":"","instagram":"","x":"","youtube":""}', 'Social media links')
on conflict (key) do nothing;
