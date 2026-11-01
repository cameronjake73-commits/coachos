# COACHOS

The operating system for independent online fitness coaches: client management, workout programming, weekly check-ins, an AI coaching assistant, a client retention dashboard and a mobile web app for clients.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres, Auth, Storage, row-level security) · Stripe (coach subscriptions) · Anthropic API (AI assistant) · Tailwind CSS. Deploys to Vercel.

---

## What's included

| Area | Coach side | Client side |
| --- | --- | --- |
| Client management | Client list, profiles, goals, fees, renewal dates, payment status, private notes, archive, GDPR delete | — |
| Onboarding | Invite link per client (copy and send by DM, email or WhatsApp) | Create password → onboarding questionnaire → explicit health-data consent |
| Programming | Templates, per-client programmes, workout days, 66-exercise library + your own exercises with video links, sets, reps, targets, rest, notes | Today's workout, set-by-set logging with "last time" numbers, session RPE, notes |
| Check-ins | Review queue, week-on-week comparison, answers, photos, custom questions | Weekly form: weight, waist, sleep, energy, stress, hunger, adherence, steps, wins, struggles, questions, up to 3 photos |
| AI assistant | Summary, changes, concerns, things to investigate, engagement trend, **drafted reply in your voice**. Nothing is sent until you approve it. Pre-generated automatically when a client submits | — |
| Retention | Dashboard: at-risk clients with reasons, overdue check-ins, renewals, revenue at risk. Explainable rule-based risk score, refreshed on every check-in or workout and nightly | — |
| Nutrition | Calories, macros, water, daily habits, notes | Shown on the home screen |
| Messaging | Per-client chat. Check-in replies are posted to the chat too | Chat with coach, unread badge |
| Progress | Trend charts, photos | Weight change, trend charts, then-vs-now photos |
| Billing | Starter £29 (10 clients), Growth £49 (30), Pro £79 (75). 14-day free trial, then locked until a plan is chosen. Stripe Checkout + Billing Portal | — |
| Emails | Invite emails, morning digest (check-ins waiting, clients at risk), new-message alerts | Invite, check-in reminder on the coach's check-in day, "coach replied" and new-message alerts |
| Accounts | Sign-up, login, forgot/reset password, delete account (cancels Stripe, erases all data) | Invite sign-up, forgot/reset password, download my data |
| Data rights | Download any client's data (JSON incl. photo links), delete client, delete account | Download my data |
| Demo | `npm run seed:demo` builds a ready-made demo coach with 11 realistic clients for sales calls | Demo client login (Emma) to show the client app |

Clients use a **mobile web app** at `/app`. They can "Add to Home Screen" (PWA manifest included), so no App Store is needed.

---

## Setup (about 30–45 minutes)

### 1. Supabase
1. Create a project at supabase.com. **Pick a UK/EU region** (e.g. London `eu-west-2`) for UK GDPR.
2. SQL Editor → run `supabase/migrations/0001_schema.sql`, then `0002_seed_exercises.sql`, then `0003_notifications.sql` (in that order).
3. Authentication → URL Configuration: set **Site URL** to your app URL and add `https://YOUR-DOMAIN/auth/callback` to Redirect URLs.
4. Authentication → Providers → Email: keep "Confirm email" on for coaches. Clients are confirmed automatically via their invite link.
5. Project Settings → API: copy the URL, `anon` key and `service_role` key.

### 2. Resend (emails)
1. Sign up at resend.com and add/verify your domain (it gives you DNS records to add).
2. Create an API key → `RESEND_API_KEY`. Set `EMAIL_FROM`, e.g. `Strong North <hello@yourdomain.com>`.
3. Without a key the app still works: emails are skipped and invite links can be copied manually.
4. Supabase sends password-reset emails itself. For production, set Supabase → Authentication → SMTP to use Resend too (Resend shows the SMTP settings), so those emails come from your domain.

### 3. Anthropic (AI assistant)
Create an API key at console.anthropic.com and set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`. Each check-in analysis costs roughly £0.01–£0.03.

### 4. Stripe
1. Products → create three monthly recurring prices in GBP: £29, £49, £79. Copy each `price_...` ID into `STRIPE_PRICE_STARTER/GROWTH/PRO`.
2. Settings → Billing → Customer portal: enable it and allow switching between those three prices and cancelling.
3. Developers → Webhooks → add endpoint `https://YOUR-DOMAIN/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Use **test mode** keys until you've tested a full signup → checkout → upgrade → cancel cycle.

### 5. Run locally
```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
npm test                     # risk-scoring tests
npm run seed:demo            # build the demo account
```
For Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### 6. Deploy to Vercel
1. Push this folder to a private GitHub repo, then import it in Vercel.
2. Add every variable from `.env.example` (set `NEXT_PUBLIC_APP_URL` to your live domain, no trailing slash).
3. Set `CRON_SECRET` to a long random string. Vercel sends it automatically to the daily job in `vercel.json` (08:00 UTC: risk scores, check-in reminders, coach digests).
4. Deploy, then update the Supabase redirect URL and the Stripe webhook URL to the live domain.

---

## Demo account for Zoom calls

```bash
npm run seed:demo
```
Creates (or resets, with fresh dates) a demo coach **Sam Fletcher / Strong North Coaching**: 11 clients with 9 weeks of check-ins, ~300 logged workouts, messages and nutrition targets, plus one invited client. Two clients are at high risk (one has gone quiet, one is drifting), one has an overdue payment, one is wavering before renewal, and 3 check-ins are waiting with AI summaries already written, so the demo works even without an AI key.

- Coach: `demo@coachos.app`, client: `client@coachos.app` (Emma Walsh). Password = `DEMO_PASSWORD` in `.env.local` (default `DemoCoach2026!`).
- Suggested call flow: Dashboard → Liam Carter's check-in (AI summary + drafted reply) → "Re-run" to show live AI → Emma's profile → programme builder → log in as Emma on your phone to show the client app.
- Re-run the command before each call so the dates look current.

---

## Security & UK GDPR: what's built and what's on you

**Built in**
- Row-level security on every table: coaches see only their own clients; clients see only their own data. Tested against Postgres.
- Plan limits enforced in the database, and billing fields can only be changed by the Stripe webhook (service role).
- Progress photos are stored in a **private** bucket and shown through 10-minute signed links.
- Explicit, separate health-data consent is recorded at client onboarding (`clients.health_consent_at`).
- Only the client's **first name** and check-in data are sent to the AI. Every AI run is logged in `ai_events`. The coach approves every reply.
- One-click client erasure (data, photos and login) from the client's Settings tab, plus full account deletion for coaches.
- Data export: coaches can download any client's data, and clients can download their own.
- AI usage capped per coach per day (`AI_DAILY_LIMIT_PER_COACH`, default 150) to protect your API bill.
- Terms of service template including UK GDPR Article 28 processor terms (`/terms`). Coaches must accept at sign-up.
- Security headers, no secrets in the browser, server-only service-role usage.

**Your to-do before taking real clients' data**
- [ ] Pay the ICO data protection fee (ico.org.uk).
- [ ] Fill in and get the privacy policy and terms reviewed (`src/app/privacy/page.tsx`, `src/app/terms/page.tsx` are templates).
- [ ] Write a short DPIA (large-scale health data) and a breach plan (72-hour ICO notification).
- [ ] Turn on Supabase backups (Pro plan) and MFA on your Supabase, Vercel, Stripe and Anthropic accounts.
- [ ] Consider cyber and professional indemnity insurance.

---

## Not built yet (sensible next steps)
- **Push notifications** for the client web app (emails cover reminders for now).
- **Collecting clients' payments** through the coach's own Stripe account (Stripe Connect). Client payment status is currently recorded manually by the coach.
- Drag-and-drop exercise reordering, programme weeks/phases, supersets.
- Food logging and barcode scanning. Nutrition is targets and habits only.
- Team accounts (multiple coaches in one business).
- Native iOS/Android apps.

## Project structure
```
src/app/coach/*        coach dashboard, clients, check-ins, programmes, exercises, settings, billing
src/app/app/*          client mobile web app
src/app/invite/*       client invite acceptance
src/app/api/stripe/*   checkout, billing portal, webhook
src/app/api/cron/daily daily risk scoring, reminders and digests
src/app/api/export/*   GDPR data downloads
src/lib/email.ts       email templates (Resend)
scripts/seed-demo.ts   demo account builder
src/lib/risk.ts        explainable risk scoring rules
src/lib/ai.ts          AI check-in analysis prompt + validation
supabase/migrations    database schema, RLS policies, storage, exercise seed
```
