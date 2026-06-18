# Campus Pulse — What This Project Actually Is

Read this **first**. There has been confusion about what was built vs. what
still needs to be built. This file is the honest map.

---

## 1. What this project IS

This Lovable project is the **web admin dashboard + shared Supabase backend**
for Campus Pulse. It is intentionally **not** the student-facing app.

You picked this split yourself earlier in the conversation:

> "Build a web admin + backend, you do Expo separately"

So this repo contains two things:

1. A **web app** for moderators / admins (built with TanStack Start + React).
2. A **Supabase backend** (Postgres tables, RLS, cron jobs, public HTTP
   endpoints) that **both** the web admin and your future Expo app will talk
   to.

The student-facing mobile app (feed, posting, background location, push
notifications, recap viewer) is **not** in this repo. It is meant to be a
separate Expo project that you build, pointing at the same Supabase. See
`EXPO_INTEGRATION.md` for the boilerplate.

---

## 2. What works right now (web side)

| Feature | Where | Status |
|---|---|---|
| College-email sign up (`@hyderabad.bits-pilani.ac.in` only) | `/auth` → calls `/api/public/auth/signup` | ✅ Working — confirmed, 1 profile already in DB |
| Email + password sign in | `/auth` | ✅ Working |
| Auth-protected routes | everything under `_authenticated/` | ✅ Working |
| Moderator approval queue (approve / reject posts) | `/moderate` | ✅ UI built, RLS enforced |
| Campus zones CRUD (name, center lat/lon, radius) | `/zones` | ✅ UI built (admin only) |
| Personal weekly recap viewer | `/recap` | ✅ UI built |
| Home / dashboard | `/` (after sign in) | ✅ Basic shell |

### Backend that's live in your Lovable Cloud project

- **Tables**: `profiles`, `user_roles`, `campus_zones`, `posts`, `reactions`,
  `location_events`, `pulse_cards`, `weekly_recaps`, `push_tokens`.
- **Row-Level Security** on every table. Students see only approved posts;
  moderators see the queue; users see only their own location events / recap.
- **Weekly post limit trigger**: max 2 posts / user / week (DB-enforced).
- **Public HTTP endpoints** the Expo app will call:
  - `POST /api/public/auth/signup` — college-email-gated signup
  - `POST /api/public/ingest-location` — converts GPS → nearest zone,
    **discards raw coordinates**, stores only `(user_id, zone_id, ts)`
  - `POST /api/public/register-push-token` — store Expo push tokens
- **Cron-style endpoints** (you wire pg_cron or external scheduler to hit them):
  - `/api/public/cron/notify-approvals` — every 5 min, push on new approvals
  - `/api/public/cron/generate-pulse` — daily, build community pulse cards
  - `/api/public/cron/generate-recap` — Mondays, build per-user recap
  - `/api/public/cron/push-recaps` — Mondays, push the recap notifications

---

## 3. What this project does NOT do

Be very clear about this — these are **not bugs**, they are out of scope for
the web side:

- ❌ **No mobile app**. No React Native, no Expo, no native build. Lovable
  cannot generate Expo projects. You build that separately.
- ❌ **No background GPS collection**. That needs `expo-location` running on a
  real device. The *server-side* zone conversion is ready and waiting; the
  *client-side* collector is your Expo job.
- ❌ **No push notifications are actually sent yet.** The `push_tokens` table
  and cron endpoints exist, but the call to Expo's push API is a TODO inside
  the cron handlers — and it can't fire until at least one Expo device
  registers a token.
- ❌ **No student feed UI on the web.** The web app is admin-only by design.
  Feed, post composer, reactions, pulse cards — all rendered in Expo.
- ❌ **pg_cron is not auto-scheduled.** The endpoints exist, but the actual
  `cron.schedule(...)` calls were not added. You either add them via a
  migration or hit the URLs from an external scheduler.
- ❌ **No Google / Apple / magic-link login.** Email + password only, as
  requested.
- ❌ **No moderator/admin role is auto-assigned.** Every new signup gets the
  `student` role. You must promote yourself manually — see §5.

---

## 4. "I can't log in" — most likely causes

The Supabase auth logs show repeated `400 invalid_credentials` from your
session. The backend is responding correctly — those errors mean the
email/password combination did not match a user. Concretely:

1. **You tried to sign in without signing up first.** Toggle the form to
   **"Need an account? Sign up"**, enter a `@hyderabad.bits-pilani.ac.in`
   email + password (8+ chars) + display name, submit. That hits
   `/api/public/auth/signup`, creates the auth user, the profile, and the
   `student` role, then signs you in.
2. **You used a non-college email.** The server rejects anything that doesn't
   end in `@hyderabad.bits-pilani.ac.in`. To change the allowed domain, edit
   `src/lib/college.ts` **and** the CHECK constraint on `profiles.email` in
   the migration.
3. **Wrong password on an existing account.** There is no password-reset flow
   wired up yet. Fastest fix: sign up with a new email.

There is already **1 profile** in your database, so signup is provably
working end-to-end.

---

## 5. How to become a moderator / admin

New signups are `student`. To approve posts or manage zones you need to
promote yourself. Open Cloud → Database → SQL editor and run **one** of:

```sql
-- become a moderator (can approve / reject posts)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'moderator' FROM auth.users WHERE email = 'you@hyderabad.bits-pilani.ac.in';

-- become an admin (also manages zones)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@hyderabad.bits-pilani.ac.in';
```

Then refresh `/moderate` or `/zones`.

---

## 6. What you need to do next

**On the Lovable side (this repo):**

- Sign up at `/auth`, promote yourself to `admin`, add a few campus zones at
  `/zones` so the location-ingest endpoint has something to snap to.
- Optionally: schedule the cron endpoints (pg_cron or a free external cron
  service hitting the four URLs above).

**On the Expo side (separate project, not in Lovable):**

- Follow `EXPO_INTEGRATION.md`. It contains:
  - Supabase client setup with the **publishable** key.
  - `expo-location` background task posting to `/api/public/ingest-location`
    every 5 min.
  - `expo-notifications` registering a token to `/api/public/register-push-token`.
  - Feed / post composer screens hitting the `posts` table directly via RLS.

---

## 7. Files worth knowing

- `src/lib/college.ts` — single source of truth for the allowed email domain.
- `src/routes/auth.tsx` — sign in / sign up form.
- `src/routes/_authenticated/*` — admin pages (require login).
- `src/routes/api/public/*` — endpoints the Expo app and cron call.
- `supabase/migrations/*.sql` — full schema, RLS, triggers.
- `EXPO_INTEGRATION.md` — boilerplate for the mobile app you build separately.
