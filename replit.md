# Campus Pulse — Admin Dashboard

## Project overview

Campus Pulse is a **web admin dashboard + Supabase backend** for a student community app. It is built with TanStack Start + React (SSR), Tailwind CSS v4, and shadcn/ui components. The student-facing mobile app is a separate Expo project (see `mobile/` and `EXPO_INTEGRATION.md`).

**This repo contains:**
- Web admin/moderator UI (TanStack Start, React 19)
- Supabase backend (Postgres, RLS, auth, cron jobs, REST/HTTP endpoints)
- API routes for the Expo mobile app

## Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (SSR) + React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database / Auth | Supabase (Postgres + Row-Level Security) |
| Runtime | Bun |
| Build / bundler | Vite 7 |

## How to run

```bash
bun install       # install dependencies
bun run dev       # starts on http://localhost:5000
```

The "Start application" workflow runs `bun run dev` and is configured to listen on port 5000.

## Environment variables

Required in `.env` (see `.env.example`):

| Variable | Description |
|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Secret — needed for server-side signup endpoint |

The anon/public keys are also set in `.replit` as shared env vars. The service role key should be stored as a Replit Secret (not committed to `.env`).

## Auth

Sign in requires a `@hyderabad.bits-pilani.ac.in` email. To grant admin access after signing up:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@hyderabad.bits-pilani.ac.in';
```

## User preferences

_None recorded yet._
