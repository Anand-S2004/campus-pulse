# Campus Pulse — What This Project Actually Is

---

## 🖥️ Run on Replit (Quick Start)

This project has two parts: the **web admin dashboard** and the **student mobile app**.
Both can run simultaneously in Replit.

### 1. Install dependencies

```bash
bun install          # web admin dependencies
bun install          # mobile app dependencies (run inside mobile/)
```

From the root of the project, you can also run:

```bash
cd mobile && bun install
```

### 2. Start the web admin dashboard

```bash
bun run dev
# → http://localhost:5000
```

This is already configured as the **Start application** workflow.

### 3. Start the Expo mobile app

```bash
cd mobile
BROWSER=none bun run start -- --port 8080
```

This is already configured as the **Start Frontend** workflow. It will print a QR code in the console. Scan it with the **Expo Go** app on your phone, or open `http://localhost:8080` in your browser to use the web version.

### Run both at once

Use the **Project** workflow (or press Run in the Replit toolbar). It starts both servers in parallel.

---

## 📱 Local Expo Mobile App Development

If you are developing the mobile app locally (not on Replit):

```bash
cd mobile
bun install
bun run start
# scan the QR code with Expo Go
```

The Expo dev server normally runs on port **8081**. On Replit it is configured to run on **8080** to avoid conflicts with the web admin dashboard.

### Mobile app environment variables

The mobile app reads these values from `app.json` under `expo.extra`:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public/anon key |
| `BACKEND_URL` | Replit backend URL for the custom HTTP API |

You can also override them by setting `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_BACKEND_URL` in your shell environment.

---

## 🌐 Local Web Admin Development

```bash
git clone https://github.com/Anand-S2004/campus-pulse.git
cd campus-pulse
bun install
```

### Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in **all four values** from your Supabase dashboard (**Settings → API**):

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Settings → API → `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` key ⚠️ keep secret |

> **"Invalid API key" error?** The most common cause is a missing or wrong `SUPABASE_SERVICE_ROLE_KEY`. The signup endpoint runs server-side and needs this key to create users — the anon key alone is not enough.

### Run the dev server

```bash
bun run dev
# → http://localhost:5000
```

### Sign up & promote yourself to admin

1. Go to `http://localhost:5000/auth`
2. Sign up with a `@hyderabad.bits-pilani.ac.in` email
3. Promote yourself in Supabase SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@hyderabad.bits-pilani.ac.in';
```

### Production build

```bash
bun run build    # SSR build → dist/
bun run preview  # preview the built output locally
```

---

## 1. What this project IS

This Lovable project is the **web admin dashboard + shared Supabase backend**
for Campus Pulse. It is intentionally **not** the student-facing app.

You picked this split yourself earlier in the conversation:

> "Build a web admin + backend, you do Expo separately"

So this repo contains two things:

1. A **web app** for moderators / admins (built with TanStack Start + React).
2. A **Supabase backend** (Postgres tables, RLS, cron jobs, public HTTP
   endpoints under `src/routes/api/public/`).

The student-facing mobile app is in the `mobile/` directory and is built with **Expo + React Native**.

## 2. How the mobile app talks to this backend

See `EXPO_INTEGRATION.md` for full API documentation.

Short version:

- The mobile app uses `@supabase/supabase-js` directly for auth, posts, feed, reactions, and weekly recaps.
- It also calls the custom backend at `BACKEND_URL` for:
  - `/api/public/auth/signup` — college-email-gated signup
  - `/api/public/ingest-location` — zone matching without storing raw GPS
  - `/api/public/register-push-token` — push token registration

## 3. Tech stack

| Layer | Technology |
|---|---|
| Web admin | TanStack Start, React 19, Vite 7, Tailwind CSS v4, shadcn/ui |
| Mobile app | Expo SDK 57, React Native 0.86, expo-router |
| Database / Auth | Supabase (Postgres + RLS) |
| Runtime | Bun |

## 4. Project layout

```
/                  web admin (TanStack Start)
  src/
    routes/          pages and API routes
    lib/             utilities
    components/      UI components
  supabase/          migrations and SQL
  mobile/            Expo mobile app
    app/             expo-router pages
    src/             hooks, lib, services, providers
```

## 5. Common issues on Replit

### "ENOSPC: System limit for number of file watchers reached"

Both Vite (web admin) and Metro (Expo) need file watchers. The kernel limit on this container is too small for both to watch everything. We fixed this by telling Vite to ignore the `mobile/` directory in its file watcher. If you still see this error, restart both workflows so the change is picked up.

### Expo QR code doesn't appear

The Expo dev server needs to start without trying to open a browser. On Replit, the workflow runs:

```bash
cd mobile && BROWSER=none bun run start -- --port 8080
```

The `BROWSER=none` flag prevents it from trying to open a browser in a headless environment, so the QR code prints in the workflow console instead.

### "Invalid API key" on mobile signup

Make sure `mobile/app.json` → `extra.SUPABASE_ANON_KEY` is the **anon** key from your Supabase project (not the service role key). The backend service role key is only used on the server side.

---

Read this **first**. There has been confusion about what was built vs. what
still needs to be built. This file is the honest map.

---

# What this project IS

This Lovable project is the **web admin dashboard + shared Supabase backend**
for Campus Pulse. It is intentionally **not** the student-facing app.

You picked this split yourself earlier in the conversation:

> "Build a web admin + backend, you do Expo separately"

So this repo contains two things:

1. A **web app** for moderators / admins (built with TanStack Start + React).
2. A **Supabase backend** (Postgres tables, RLS, cron jobs, public HTTP
   endpoints).

The student-facing mobile app is built separately in **Expo + React Native**.

---

# What this project is NOT

- It is **not** the mobile app. That is the Expo project in `mobile/`.

---

# Live URLs (if you publish this Lovable project)

| Environment | URL |
|---|---|
| Production | `https://project--a47d5318-90cc-49fa-a067-99b4350c777a.lovable.app` |
| Development | `https://project--a47d5318-90cc-49fa-a067-99b4350c777a-dev.lovable.app` |

On Replit, the running backend URL is shown in the preview pane port selector.

---

# The Web Admin

## Purpose

Moderators and admins use the web app to:

- Approve / reject student posts
- Manage campus zones
- View weekly recaps and community stats
- Oversee users and roles

## Tech Stack

- **Framework:** TanStack Start (React, SSR, Vite)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Auth:** Supabase Auth (email/password, college email gated)
- **Database:** Supabase Postgres with RLS

## Web Routes

| Route | Purpose |
|---|---|
| `/` | Feed (authenticated) |
| `/auth` | Sign in / sign up |
| `/moderate` | Post approval queue |
| `/zones` | Admin zone CRUD |
| `/recap` | Weekly recap |
| `/api/public/*` | Public HTTP endpoints used by the mobile app |

---

# The Mobile App (Expo)

See the `mobile/` directory and `EXPO_INTEGRATION.md` for the full API guide.

## Mobile app setup

```bash
cd mobile
bun install
bun run start
# scan the QR code with Expo Go
```

On Replit, the mobile app is configured to run on port **8080** and prints a QR code in the **Start Frontend** workflow console.

## Mobile App Responsibilities

- Student auth (email/password, college email gated)
- Submit posts (max 2/week, goes to pending approval)
- Heart / react to posts
- View daily Community Pulse and weekly recap
- Background location tracking for anonymous zone matching
- Push notifications

---

# The Supabase Backend

## Database Tables

```
profiles          one per auth user (college email enforced by CHECK)
user_roles        admin | moderator | student
campus_zones      circular zones (name, center_lat, center_lon, radius_m)
posts             user_id, category, location_label, description, status, ...
reactions         (post_id, user_id) — single ❤️
location_events   zone_id + occurred_at ONLY (raw GPS never stored)
pulse_cards       auto-generated daily "Community Pulse" snippets
weekly_recaps     per-user, per-week stats card
push_tokens       Expo push tokens
```

## Public API Endpoints

Located in `src/routes/api/public/`:

| Endpoint | Purpose |
|---|---|
| `/api/public/auth/signup` | College-email-gated signup, creates profile, assigns `student` role |
| `/api/public/ingest-location` | Receives raw GPS, matches to campus zone, stores only zone_id + timestamp |
| `/api/public/register-push-token` | Registers Expo push token |
| `/api/public/cron/generate-pulse` | Generates daily pulse cards (called by pg_cron) |
| `/api/public/cron/generate-recap` | Generates weekly recap (Monday) |
| `/api/public/cron/notify-approvals` | Every 5 min: pushes approved post notifications |
| `/api/public/cron/push-recaps` | Sub-route: pushes recap notifications |

## Cron Jobs

Already scheduled via `pg_cron`:

- **Every 5 minutes:** push newly approved post notifications
- **Daily:** generate Community Pulse cards
- **Every Monday:** generate weekly recaps and push notifications

---

# Authentication

## College Email Domain

Default: `@hyderabad.bits-pilani.ac.in`

To change it, edit:
1. `src/lib/college.ts` → `COLLEGE_EMAIL_DOMAIN`
2. Run a migration to update the `profiles.college_email_only` CHECK constraint regex.

## Role Assignment

Make someone an admin or moderator from Supabase SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@hyderabad.bits-pilani.ac.in';
```

Replace `'admin'` with `'moderator'` for moderation-only access.

---

# Weekly Recap Design Rule

Every recap card should answer one question:

> "How can this statistic reinforce togetherness?"

If a statistic only reports activity but does not strengthen belonging, it should not appear in the recap.

The recap is not a dashboard. It is a reminder that students are part of a larger community.

---
