# QURANDAZI — Your Chance. Your Moment.

A platform for running **free-entry** promotional draws. It has three interfaces:

- **Public website:** home, campaigns, campaign details, winners and draw audits, how it works, about, FAQs, contact, terms and privacy.
- **User dashboard:** overview, profile, available campaigns, my entries, draw history, notifications and account settings.
- **Admin console:** dashboard and analytics, users, categories, campaigns, entries, draws, winners, announcements, contact inbox, reports, activity logs and system settings.

**Stack:** React 18 + Vite, Tailwind CSS, React Router, Supabase (Auth, Postgres, Storage, Edge Functions), Recharts, Lucide icons and React Hot Toast.

> Every campaign is free to enter. There are no payment gateways, tickets or deposits. Category amounts such as "PKR 20,000" are informational legacy labels only.

---

## 1. Local setup

```bash
npm install
cp .env.example .env.local      # then fill in your Supabase URL + anon key
npm run dev                     # http://localhost:5173
```

If the env vars are missing, the app still renders and shows a yellow "Supabase is not configured" banner.

## 2. Supabase setup

1. Create a project at <https://supabase.com>.
2. **Run the SQL.** In SQL Editor, run these files in order:
   - `supabase/migrations/20260101000001_schema.sql`
   - `supabase/migrations/20260101000002_functions.sql`
   - `supabase/migrations/20260101000003_rls.sql`
   - `supabase/migrations/20260101000004_storage.sql`
   - `supabase/seed.sql` (adds the Grande / Alto / 125 categories, three sample campaigns and the site settings)

   With the Supabase CLI you can run `supabase link` and then `supabase db push` instead, followed by `psql … -f supabase/seed.sql`.
3. **Configure Auth.** Under Authentication → URL Configuration:
   - Set **Site URL** to `http://localhost:5173` (your Vercel URL in production).
   - Add these **Redirect URLs**: `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password`, plus the same two paths on your production domain.
   - Keep **Confirm email** enabled under Providers → Email.
4. **Deploy the Edge Function.** It's used to add and delete users:
   ```bash
   supabase functions deploy admin-users
   supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
   ```
   `SUPABASE_SERVICE_ROLE_KEY` is injected automatically inside Edge Functions. **Never put it in `.env` or any `VITE_` variable.**
5. **Create the first Super Admin.** Register normally through the website, then run this in the SQL Editor:
   ```sql
   update public.user_roles set role = 'super_admin'
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```
   Sign out and back in. You are redirected to `/admin`. Other staff can then be created or promoted from **Admin → Users**.

## 3. Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel. Use the **Vite** framework preset, build command `npm run build` and output directory `dist`.
2. Add the environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SITE_URL` (your production URL, with no trailing slash).
3. `vercel.json` already sets up the SPA rewrites and the security headers.
4. Add your production URL to the Supabase Auth Site URL and Redirect URLs, and to `ALLOWED_ORIGINS`.

---

## 4. Security model

| Concern | How it is enforced |
| --- | --- |
| Authorization | Row Level Security is on for **every** table. Role checks (`is_admin()`, `is_super_admin()`) run in Postgres. React route guards are only a convenience for the UI. |
| Privileged operations | Done through `SECURITY DEFINER` RPCs (joining, entry review, the draw lifecycle, announcements, role changes) plus the `admin-users` Edge Function for creating and deleting auth users. |
| Role escalation | `user_roles` has no write policies. Only `admin_set_user_role()` can change a role, and only a Super Admin can call it (not on their own account). |
| Profile tampering | A trigger blocks users from changing their own `status`, `email` or other auth-mirrored fields. |
| Duplicate entries | The `unique (campaign_id, user_id)` constraint, plus checks inside `join_campaign()`. |
| Validation | Database `CHECK` constraints, server-side eligibility rules and client-side form validation. |
| Audit | `admin_activity_logs` is append-only; a trigger rejects any update or delete. Admin changes to categories, campaigns, rules, settings, profiles and messages are captured by triggers. Draw actions, role changes, exports and Edge Function actions are logged explicitly. |
| Service-role key | It is only used inside the Edge Function and never appears in frontend code. |

### Transparent draw algorithm (`QZ-SHA256-v1`)

A draw goes through these stages:

1. **Schedule.** The draw must be scheduled at or after the campaign closes. Each campaign can have only one live draw.
2. **Freeze.** This is only allowed after the campaign closes. Eligible entries are copied into an immutable `draw_snapshots` table, numbered `1..N` by entry time. The system then:
   - computes `snapshot_hash = SHA256("1:REF\n2:REF\n…")`;
   - draws a 256-bit seed from `gen_random_bytes` (a cryptographically secure source) and stores it in `draw_secrets`, which has no API access;
   - publishes only the commitment `SHA256(seed)`.
3. **Execute.** This is only allowed at or after the scheduled time, and only once. For each rank `k`:
   - `h = SHA256(seed:snapshot_hash:k)`
   - the winner is `pool[int(h[0:15]) mod |pool|]`, which is then removed from the pool.
   The seed is revealed at this point. Results are immutable, and a draw that has been executed cannot be cancelled and re-run.
4. **Approve.** A Super Admin must approve. If another active Super Admin exists, the approver must be different from the person who executed the draw.
5. **Publish.** Results go public, and winners and participants are notified.

Anyone can open **Winners → Verify**. Their browser then recomputes the snapshot hash, checks the seed commitment and re-derives every winner (`src/utils/drawVerification.js`).

---

## 5. Project structure

```
src/
  assets/  components/{ui,layout,campaign}  layouts/  context/  hooks/
  pages/{public,auth,user,admin}  routes/  services/  utils/  App.jsx  main.jsx
supabase/
  migrations/   functions/admin-users/   seed.sql   config.toml
```

The reusable components are `Navbar`, `Footer`, `Sidebar`, `DashboardHeader`, `StatCard`, `CampaignCard`, `DataTable` (which turns into stacked cards on mobile), `Modal`, `FormInput`/`Select`/`TextArea`/`Toggle`, `ConfirmationDialog` (supports typed confirmation and a required reason), `Pagination`, `ImageUpload`, `Dropdown`, `Badge`, skeletons, and empty and error states.

## 6. Notes before going to production

- Have the Terms and Privacy pages reviewed by legal counsel for your jurisdiction.
- Configure a custom SMTP provider in Supabase Auth. The built-in one is rate-limited.
- Freezing and executing draws are manual admin actions on purpose. If you want them to run automatically on a schedule, you can call `freeze_draw` and `execute_draw` from `pg_cron` using a dedicated service account.
