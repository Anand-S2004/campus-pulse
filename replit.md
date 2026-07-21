# Campus Pulse

A campus social platform for BITS Pilani Hyderabad.

## Tech stack
- Frontend: React + Vite + TanStack Start
- Styling: Tailwind CSS + shadcn/ui
- Backend: Supabase (Postgres + Auth + RLS)
- Mobile: Separate Expo app (see `EXPO_INTEGRATION.md`)

## Project structure
- `src/routes/` — web pages and API routes
- `src/lib/` — shared utilities and hooks
- `src/integrations/supabase/` — Supabase clients and types
- `supabase/migrations/` — database migrations
- `EXPO_INTEGRATION.md` — guide for the separate Expo mobile app

## Active Supabase project
https://zmjkkasiihycuutikims.supabase.co

## User preferences
- College email domain: `@hyderabad.bits-pilani.ac.in`
- Location tracking is privacy-first: only the matched campus zone is stored, never raw GPS coordinates.
