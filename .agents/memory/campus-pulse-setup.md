---
name: Campus Pulse — Working Setup
description: Final verified working configuration for Campus Pulse on Replit (Supabase project, env vars, known fixes).
---

# Campus Pulse — Working Setup

## Active Supabase project
`zmjkkasiihycuutikims` — this matches the service role key the user has, and is stated as active in replit.md.

**The `.env` file in the repo is stale** (points to a different project `mtqyrbyudtduyoqtumlt`). Replit env vars override `.env`, so all real credentials are set as Replit environment variables.

## Environment
- All Supabase vars set as Replit shared env vars (not `.env` file): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BACKEND_URL`
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- Mobile BACKEND_URL: `https://6b387340-0efc-40fb-aafc-c46708c89e03-00-1327hnc5xtsxn.pike.replit.dev`

## Bug fixes applied
- `src/routes/_authenticated/route.tsx`: Moved `nav()` call into `useEffect` to fix "setState during render" React warning (Transitioner/AuthedLayout)
- `src/routes/api/public/ingest-location.ts`: Added `ws` package as transport to both inline `createClient` calls — Node 20 has no native WebSocket, causing crash without it

## Feature verification results (all passing)
- Signup via `/api/public/auth/signup` ✅
- Post creation via `/api/public/create-post` ✅
- Location ingestion: in-zone → `{matched:true, zone_name}`, off-campus → `{matched:false}` ✅
- Cron generate-pulse ✅
- Cron notify-approvals ✅
- Cron generate-recap ✅
- Both workflows running: web (5000), Expo mobile (8080) ✅

**Why:** Future work needs to know which project is active and what env strategy is used. The .env file confusion caused significant debugging time.

**How to apply:** If the SUPABASE_SERVICE_ROLE_KEY stops working, decode its JWT payload (middle segment, base64) and confirm `ref` matches `zmjkkasiihycuutikims`.
