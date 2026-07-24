# Campus Pulse

A campus social platform for BITS Pilani Hyderabad — moderated community moments, anonymous location zone tracking, daily Pulse cards, weekly recaps, and push notifications.

---

## Project layout

```
/                    Web admin (TanStack Start + React + Vite)
  src/
    routes/            Pages and API routes
    routes/api/public/ Public HTTP endpoints used by the mobile app
    lib/               Shared utilities
    components/        UI components
  supabase/
    migrations/        Database migrations (apply via Supabase SQL Editor)
    setup-pg-cron.sql  pg_cron schedule statements (run once in SQL Editor)
  heartbits/           Expo mobile app
    app/               expo-router pages
    src/               hooks, lib, services, providers
```

---

## 🖥️ Run on Replit

This project runs as two parallel workflows. Press **Run** (or start the **Project** workflow) to launch both.

| App | Workflow | Port |
|-----|----------|------|
| Web admin dashboard | `Start application` | 5000 |
| Expo mobile (web + QR) | `Start Frontend` | 8080 |

### First-time setup

```bash
# Install web admin dependencies
bun install

# Install mobile app dependencies
cd heartbits && bun install
```

### Required secrets

Set these in Replit → Secrets before starting:

| Secret | Where to find it |
|--------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → service_role key |
| `CRON_SECRET` | Any long random string you choose |

The public env vars (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_*`, `EXPO_PUBLIC_*`) are already configured in the Replit environment.

### Sign up & become admin

1. Open the web admin at port 5000 → `/auth`
2. Sign up with a `@hyderabad.bits-pilani.ac.in` email
3. Promote yourself in Supabase SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@hyderabad.bits-pilani.ac.in';
```

---

## 🔁 pg_cron setup (one-time)

The cron jobs are **not** self-registering — you must schedule them once in the Supabase SQL Editor.

**`supabase/setup-pg-cron.sql`** contains the ready-to-run statements with the current Replit dev domain already filled in. Steps:

1. **Enable extensions** in Supabase dashboard → Database → Extensions → enable `pg_cron` and `pg_net`
2. Open **SQL Editor** for project `zmjkkasiihycuutikims`
3. Paste the contents of `supabase/setup-pg-cron.sql`
4. Replace `YOUR_CRON_SECRET` with your `CRON_SECRET` secret value
5. Run — then verify with:

```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
```

| Job | Schedule | What it does |
|-----|----------|-------------|
| `notify-approvals` | Every 5 min | Pushes "your post is live" to authors |
| `generate-pulse` | Daily 08:00 UTC | Creates Community Pulse cards |
| `generate-recap` | Mondays 09:00 UTC | Generates weekly recaps + push notifications |

> ⚠️ **Domain changes:** The Replit dev domain can change when the repl restarts. If cron jobs stop firing, update `supabase/setup-pg-cron.sql` with the new domain, run `cron.unschedule()` for each job, then re-run the schedule statements.

---

## 🌐 Local development (off Replit)

```bash
git clone https://github.com/Anand-S2004/campus-pulse.git
cd campus-pulse
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
bun install
bun run dev   # → http://localhost:5000
```

For the mobile app:

```bash
cd heartbits
bun install
bun run start   # scan QR with Expo Go
```

---

## 🗄️ Supabase backend

### Database tables

```
profiles          one per auth user (college email enforced by CHECK)
user_roles        admin | moderator | student
campus_zones      circular zones (name, center_lat, center_lon, radius_m)
posts             user_id, category, location_label, description, status, …
reactions         (post_id, user_id) — single ❤️
location_events   zone_id + occurred_at ONLY (raw GPS never stored)
pulse_cards       auto-generated daily Community Pulse snippets
weekly_recaps     per-user, per-week stats card
push_tokens       Expo push tokens
```

### Public API endpoints

Located in `src/routes/api/public/`:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/api/public/auth/signup` | none | College-email-gated signup; creates profile + assigns `student` role |
| `/api/public/ingest-location` | bearer token | Receives raw GPS, matches to campus zone, stores only zone_id + timestamp |
| `/api/public/register-push-token` | bearer token | Registers Expo push token |
| `/api/public/cron/generate-pulse` | `apikey` header (CRON_SECRET) | Generates daily Pulse cards |
| `/api/public/cron/generate-recap` | `apikey` header (CRON_SECRET) | Generates weekly recaps |
| `/api/public/cron/notify-approvals` | `apikey` header (CRON_SECRET) | Pushes approval notifications |
| `/api/public/cron/push-recaps` | `apikey` header (CRON_SECRET) | Sub-route: sends recap push notifications |

See `EXPO_INTEGRATION.md` for the full mobile API guide.

---

## 🔐 Authentication

### College email domain

Default: `@hyderabad.bits-pilani.ac.in`

To change it:
1. Edit `src/lib/college.ts` → `COLLEGE_EMAIL_DOMAIN`
2. Run a migration to update the `profiles.college_email_only` CHECK constraint regex

### Role assignment

```sql
-- Make someone an admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@hyderabad.bits-pilani.ac.in';

-- Make someone a moderator
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'moderator' FROM auth.users WHERE email = 'mod@hyderabad.bits-pilani.ac.in';
```

---

## 🖥️ Web admin routes

| Route | Purpose |
|-------|---------|
| `/` | Feed (authenticated) |
| `/auth` | Sign in / sign up |
| `/moderate` | Post approval queue |
| `/zones` | Admin zone CRUD |
| `/recap` | Weekly recap viewer |

---

## 📱 Mobile app (heartbits/)

The student-facing Expo app handles:
- Auth (college email gated)
- Submitting posts (max 2/week; goes to pending approval)
- Reacting to posts (❤️)
- Viewing daily Community Pulse and weekly personal recap
- Background location tracking (zone matching only — raw GPS never leaves the device)
- Push notifications

### Mobile env vars

Set in Replit environment (shared):

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `EXPO_PUBLIC_BACKEND_URL` | Web admin backend URL (Replit dev domain) |

---

## 🧱 Tech stack

| Layer | Technology |
|-------|-----------|
| Web admin | TanStack Start, React 19, Vite 7, Tailwind CSS v4, shadcn/ui |
| Mobile app | Expo SDK 57, React Native 0.86, expo-router |
| Database / Auth | Supabase (Postgres + RLS + Auth) |
| Runtime | Bun |
| Cron | pg_cron + pg_net inside Supabase |

---

## 🔁 Weekly recap design rule

Every recap card should answer one question:

> "How does this statistic reinforce togetherness?"

If a stat only reports activity without strengthening belonging, it doesn't belong in the recap. The recap is a reminder that students are part of a larger community — not a personal dashboard.
