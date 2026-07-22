# Campus Pulse

A campus social platform for BITS Pilani Hyderabad — moderated community moments, location zone tracking, weekly recaps, and push notifications.

## Tech stack
- **Web admin**: React + Vite + TanStack Start (SSR), Tailwind CSS + shadcn/ui
- **Mobile**: Expo (React Native) — `heartbits/` folder
- **Backend**: Supabase (Postgres + Auth + RLS) — project `zmjkkasiihycuutikims`
- **Cron**: pg_cron inside Supabase triggers `/api/public/cron/*` endpoints

## Running on Replit

| App | Workflow | Port |
|-----|----------|------|
| Web admin dashboard | `Start application` (`bun run dev`) | 5000 |
| Expo mobile (web mode) | `Start Frontend` (`cd heartbits && BROWSER=none bun run start -- --port 8080`) | 8080 |

Both start together via the **Project** workflow.

## Project structure
- `src/routes/` — web pages and API routes
- `src/routes/api/public/` — public API endpoints (used by mobile app)
- `src/routes/api/public/cron/` — cron-triggered endpoints (generate-pulse, generate-recap, notify-approvals, push-recaps)
- `src/lib/` — shared utilities and hooks
- `src/integrations/supabase/` — Supabase clients and types
- `supabase/migrations/` — database migrations (apply via Supabase SQL Editor)
- `heartbits/` — Expo mobile app
- `ARCHITECTURE.md` — architecture decisions
- `EXPO_INTEGRATION.md` — mobile integration guide

## Active Supabase project
https://zmjkkasiihycuutikims.supabase.co

**Important**: The `.env` file in the repo root may be stale. All active Supabase credentials are set as Replit environment variables (shared environment). The service role key is stored as a Replit Secret.

## Required secrets / env vars
| Key | Where set | Purpose |
|-----|-----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Replit Secret | Signup, post creation, cron jobs |
| `CRON_SECRET` | Replit Secret | Authenticates pg_cron → `/api/public/cron/*` calls |
| `SUPABASE_URL` | Replit env var | Points to `zmjkkasiihycuutikims` |
| `SUPABASE_PUBLISHABLE_KEY` | Replit env var | Anon/public key |
| `VITE_SUPABASE_URL` | Replit env var | Same, for Vite client bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Replit env var | Same, for Vite client bundle |
| `EXPO_PUBLIC_SUPABASE_URL` | Replit env var | Mobile app Supabase URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Replit env var | Mobile app anon key |
| `EXPO_PUBLIC_BACKEND_URL` | Replit env var | Mobile → web backend URL (Replit dev domain) |

## Supabase pg_cron setup
The cron jobs call the web backend with `apikey: <CRON_SECRET>` header. Configure these in Supabase SQL Editor:

```sql
-- Every 5 min: push approved post notifications
SELECT cron.schedule('notify-approvals', '*/5 * * * *',
  $$SELECT net.http_post(url := 'https://<YOUR_REPLIT_DEV_DOMAIN>/api/public/cron/notify-approvals',
    headers := '{"apikey":"<CRON_SECRET>"}', body := '{}')$$);

-- Daily: generate Community Pulse cards
SELECT cron.schedule('generate-pulse', '0 8 * * *',
  $$SELECT net.http_post(url := 'https://<YOUR_REPLIT_DEV_DOMAIN>/api/public/cron/generate-pulse',
    headers := '{"apikey":"<CRON_SECRET>"}', body := '{}')$$);

-- Every Monday: generate weekly recaps
SELECT cron.schedule('generate-recap', '0 9 * * 1',
  $$SELECT net.http_post(url := 'https://<YOUR_REPLIT_DEV_DOMAIN>/api/public/cron/generate-recap',
    headers := '{"apikey":"<CRON_SECRET>"}', body := '{}')$$);
```

## User preferences
- College email domain: `@hyderabad.bits-pilani.ac.in`
- Location tracking is privacy-first: only the matched campus zone is stored, never raw GPS coordinates.
- Mobile app is the priority feature surface; web is admin/moderation only.
