---
name: Campus Pulse setup
description: Active Supabase project, env var layout, stale .env situation, and how to get the project running.
---

# Campus Pulse Setup

## Active Supabase project
`zmjkkasiihycuutikims` — https://zmjkkasiihycuutikims.supabase.co

## Environment variable layout
- Non-secret vars (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_*`, `EXPO_PUBLIC_*`) are set in `.replit` under `[userenv.shared]`.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) are Replit Secrets.
- The `.env` file in the repo root is stale (points to old project `mtqyrbyudtduyoqtumlt`) and cannot be edited via agent tools. Bun does NOT override existing `process.env` values with `.env`, so the Replit env vars win at runtime.

## How to run
- Web admin: `bun run dev` → port 5000 (`Start application` workflow)
- Mobile (web mode): `cd heartbits && BROWSER=none bun run start -- --port 8080` → port 8080 (`Start Frontend` workflow)
- Dependencies must be installed first: `bun install` at root and `cd heartbits && bun install`

## Known non-fatal error on Expo start
`libglib-2.0.so.0: cannot open shared object file` — this is the optional React Native DevTools debugger shell failing to load. Metro bundler still starts and serves normally.

**Why:** The NixOS container doesn't have glib. This is a cosmetic error; ignore it.

## Expo QR code limitation
Metro prints an internal IP (172.x.x.x) that is unreachable from a phone. To test on a real device, the start command needs `--tunnel` or `--host` set to the Replit dev domain.
