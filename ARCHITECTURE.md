# Campus Pulse — Architecture Reference

## Running the App

### Development
```bash
bun install        # install dependencies
bun run dev        # start dev server at http://localhost:5000
```

### Production build
```bash
bun run build      # SSR build via Vite + Nitro → dist/
bun run preview    # preview the production build locally
```

> **Allowed sign-up email domain:** `@hyderabad.bits-pilani.ac.in`

---
npm install
## File Map — What Does What

### Configuration

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite + TanStack Start build config. Sets dev server to `0.0.0.0:5000` with `allowedHosts: true` for the Replit proxy. |
| `tsconfig.json` | TypeScript compiler settings; `@` alias maps to `src/`. |
| `bunfig.toml` | Bun package manager settings (24 h supply-chain guard). |
| `.env` | Supabase project ID, URL, and anon key (client-safe). |
| `supabase/config.toml` | Local Supabase CLI config (not used in production). |
| `supabase/migrations/` | SQL migrations — DB schema, RLS policies, indexes. |
| `components.json` | shadcn/ui component registry config. |

### PWA (installable as app)

| File | Purpose |
|------|---------|
| `public/manifest.json` | Web App Manifest — app name, icons, theme colour, `display: standalone`. Required for "Add to Home Screen". |
| `public/sw.js` | Service Worker — caches static pages for offline support; network-first for navigation, cache-first fallback. |
| `src/routes/__root.tsx` | Registers the manifest link, PWA meta tags, and injects the service worker bootstrap script into every page. |

### Auth & Domain Gate

| File | Purpose |
|------|---------|
| `src/lib/college.ts` | **Single source of truth** for the allowed email domain (`hyderabad.bits-pilani.ac.in`). Change the domain here only. |
| `src/routes/auth.tsx` | Sign-in / Sign-up UI. Uses `isCollegeEmail()` for client-side validation before submitting. |
| `src/routes/api/public/auth/signup.ts` | `POST /api/public/auth/signup` — server-side signup. Re-validates domain, creates Supabase auth user (auto-confirmed), inserts `profiles` row, assigns `student` role. |
| `src/integrations/supabase/auth-middleware.ts` | `requireSupabaseAuth()` helper — validates the session JWT on server routes. |
| `src/lib/use-auth.ts` | React hook for client-side auth state and role (`admin` / `moderator` / `student`). |

### Supabase Client

| File | Purpose |
|------|---------|
| `src/integrations/supabase/client.ts` | Public (anon) Supabase client for browser and SSR. Reads `VITE_SUPABASE_*` env vars. |
| `src/integrations/supabase/client.server.ts` | Admin Supabase client (service role key) — **server-only**, never bundled to the client. |
| `src/integrations/supabase/types.ts` | Auto-generated TypeScript types from the DB schema. |

### Routes — Pages

| Route | File | What it does |
|-------|------|-------------|
| `/auth` | `src/routes/auth.tsx` | Sign-in + Sign-up page (college email gated). |
| `/_authenticated` | `src/routes/_authenticated/route.tsx` | Pathless layout guard — redirects unauthenticated users to `/auth`; renders the top navigation bar. |
| `/` | `src/routes/_authenticated/index.tsx` | **Feed** — Community Pulse cards and approved student posts. |
| `/recap` | `src/routes/_authenticated/recap.tsx` | **My Week** — personal weekly stats and activity summary. |
| `/moderate` | `src/routes/_authenticated/moderate.tsx` | **Moderation Queue** — approve or reject pending posts (moderator/admin only). |
| `/zones` | `src/routes/_authenticated/zones.tsx` | **Campus Zones** — manage geographic campus areas / geofences (admin only). |

### Routes — Public API (used by Expo mobile app)

| Route | File | What it does |
|-------|------|-------------|
| `POST /api/public/auth/signup` | `src/routes/api/public/auth/signup.ts` | Gated user registration. |
| `POST /api/public/register-push-token` | `src/routes/api/public/register-push-token.ts` | Saves Expo push notification tokens. |
| `POST /api/public/ingest-location` | `src/routes/api/public/ingest-location.ts` | Receives background location pings from the mobile app. |

### Routes — Cron Jobs

| Route | File | What it does |
|-------|------|-------------|
| `POST /api/public/cron/generate-pulse` | `src/routes/api/public/cron/generate-pulse.ts` | Daily — aggregates location data into Pulse cards. |
| `POST /api/public/cron/generate-recap` | `src/routes/api/public/cron/generate-recap.ts` | Weekly — generates personalised recaps per user. |
| `POST /api/public/cron/notify-approvals` | `src/routes/api/public/cron/notify-approvals.ts` | Sends push notifications when a post is approved. |
| `POST /api/public/cron/push-recaps` | `src/routes/api/public/cron/push-recaps.ts` | Triggers push notifications for new weekly recaps. |

### App Shell & Shared

| File | Purpose |
|------|---------|
| `src/routes/__root.tsx` | Root HTML shell — QueryClient provider, global Toaster, head tags, PWA wiring. |
| `src/server.ts` | SSR entry point — wraps TanStack Start's server handler and normalises catastrophic SSR errors into a user-friendly 500 page. |
| `src/start.ts` | Client hydration entry point. |
| `src/routeTree.gen.ts` | Auto-generated route tree (do not edit manually — updated by `vite dev`). |
| `src/styles.css` | Global Tailwind CSS + CSS variable tokens. |
| `src/lib/error-capture.ts` | Captures the last unhandled error so the SSR wrapper can surface it. |
| `src/lib/error-page.ts` | Static HTML fallback for catastrophic SSR failures. |
| `src/lib/lovable-error-reporting.ts` | Dev-only error reporting hook. |
| `src/components/ui/` | shadcn/ui component library (Button, Card, Input, etc.). |
| `src/hooks/use-mobile.tsx` | Hook to detect mobile viewport breakpoint. |

---

## Environment Variables

| Variable | Where used |
|----------|-----------|
| `VITE_SUPABASE_URL` | Browser + SSR Supabase client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + SSR Supabase client (anon key) |
| `SUPABASE_URL` | Server-only Supabase admin client |
| `SUPABASE_PUBLISHABLE_KEY` | Server-only Supabase admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase admin client (set as a Replit Secret) |

---

## Mobile App (Expo)

The companion Expo mobile app is a separate repository. See `EXPO_INTEGRATION.md` for the full integration guide covering:
- Auth signup via `/api/public/auth/signup`
- Background location ingestion via `/api/public/ingest-location`
- Push token registration via `/api/public/register-push-token`
- Cron job trigger endpoints
