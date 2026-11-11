# QURANDAZI — Your Chance. Your Moment.

A platform for running deposit-backed promotional draws. Members verify their identity (KYC), make a **refundable** deposit for a category and then join that category's campaigns. It has three interfaces:

- **Public website:** home, campaigns, campaign details, winners and draw audits, how it works, about, FAQs, contact, terms and privacy.
- **User dashboard:** overview, profile and CNIC verification (KYC), my deposits (deposit and withdraw), available campaigns, my entries, draw history, notifications and account settings.
- **Admin console:** dashboard and analytics, users, KYC reviews, deposits (verify, reject, refund), categories (deposit amount and lock-in), campaigns, entries, draws, winners and prize handovers, announcements, contact inbox, reports, activity logs, and system settings (including deposit terms and bank details).

**Stack:** React 18 + Vite, Tailwind CSS, React Router, Supabase (Auth, Postgres, Storage, Edge Functions), Recharts, Lucide icons and React Hot Toast.

> No entry fee is ever charged. Each category requires a refundable deposit (Alto PKR 10,000, 125 PKR 5,000, Grande PKR 20,000), paid through the company's own bank account or payment gateway and verified manually by an admin. The app records payment references; it does not move money itself.

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
   - `supabase/migrations/20260101000005_deposits_kyc.sql` (KYC, deposits, deposit-gated entries, prize handovers and the private storage buckets)
   - `supabase/migrations/20260101000006_wallet_payments_open_deposits.sql` (mobile-wallet payments; deposits can be submitted before KYC is complete)
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
| KYC & deposits | CNIC fields can only change through `submit_kyc()` / `admin_review_kyc()`, and the profile guard enforces this. Deposits have no write policies: every status change goes through an RPC. A trigger allows only Pending → Verified/Rejected → Withdrawal Requested → Refunded, keeps submitted details unchanged and blocks deletes. Each CNIC and each bank transaction ID can be used only once. |
| Private documents | CNIC images, payment proofs and handover documents are stored in **private** buckets (`kyc-documents`, `deposit-proofs`, `handover-documents`). Users can upload and read only inside their own folder and can't overwrite or delete. Admins view files through 5-minute signed URLs. |
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


### Deposit-gated participation (migration `0005`)

1. **Register & KYC.** The member verifies their email, completes their profile (name, phone and address) and submits their CNIC number with front and back images. The CNIC must be unique across accounts. An admin reviews it in **Admin → KYC Reviews**: Verified, or Rejected with a required reason. A user's name is locked once their CNIC is pending or verified.
2. **Deposit.** A KYC-verified member chooses a category in **My Deposits** and reviews the terms: the amount, the lock-in period, the refund rules, and that the deposit is not a fee. The terms text, bank details and an early-withdrawal switch are in **Admin → System Settings → Deposits & payments**. The member then pays and submits the transaction ID, with optional proof. The deposit becomes **Pending**. The amount, lock-in period and terms version are snapshotted on the deposit.
3. **Verify.** In **Admin → Deposits**, the admin matches the deposit against the bank statement and marks it **Verified** (or **Rejected**, with a required reason). The member is notified, for example "Deposit verified — you're now eligible for Grande campaigns." `locked_until` is set to the verification time plus the lock-in period.
4. **Join.** A campaign requires the deposit amount of its category. The member can join only with a verified, active deposit of at least that amount, so a Grande deposit covers Alto and 125. Otherwise `check_campaign_eligibility()` lists exactly what is missing. The one-entry rule and the `QZ-` references are unchanged.
5. **Freeze.** `freeze_draw()` adds only entries whose deposit was **active at the campaign's closing time**: verified before `end_date`, with no withdrawal requested before `end_date`. The deposit rule and the number of excluded entries are stored on the draw and shown in the public audit. The commit-and-reveal draw itself is unchanged.
6. **Handover.** In **Admin → Winners**, the admin types the CNIC from the card the winner presents. It must match the winner's verified CNIC, and a mismatch is logged and blocked. The handover is recorded with the date, prize, documents and notes. Handover records can't be changed afterwards.
7. **Withdraw.** After the lock-in period (or any time, if early withdrawal is switched on), the member requests a withdrawal and gives refund account details. The app first lists any open campaigns whose entries would then be excluded. The admin pays out and records the payout transaction ID, and the status goes from **Withdrawal Requested** to **Refunded**.

Each step is written to the activity log, including the user's own KYC submissions, deposits and withdrawal requests.

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

- Have the Terms, Privacy and deposit terms reviewed by legal counsel. Taking refundable deposits from the public and linking them to prize draws may need licensing or approval (for example from SBP/SECP, and under the prize-scheme and lottery rules) before you launch.
- Fill in the company bank details in **System Settings → Deposits & payments** before opening deposits.
- Configure a custom SMTP provider in Supabase Auth. The built-in one is rate-limited.
- Freezing and executing draws are manual admin actions on purpose. If you want them to run automatically on a schedule, you can call `freeze_draw` and `execute_draw` from `pg_cron` using a dedicated service account.
