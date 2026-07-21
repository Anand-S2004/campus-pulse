---
name: Campus Pulse — Project Goals
description: User's stated goals and priorities for the Campus Pulse project setup and feature work.
---

# Campus Pulse — Project Goals

## Priority
**Mobile app is the top priority.** Web admin dashboard is secondary.

## Goal
Get both the web app and the Expo mobile app (in `heartbits/`) fully running on Replit, with ALL features working end-to-end.

## Required features (mobile-first)
- Location tracking (nearest campus zone/bucket — privacy-first, only store matched zone not raw GPS)
- Post creation and feed
- Feed clearing / refresh
- Post approval workflow (moderation)
- Nearest location bucket matching
- Weekly recap (generated and pushed via cron)
- Push notifications (Expo push tokens, approval notifications, recap notifications)
- Community Pulse cards (daily, generated via cron)
- Auth (college email domain: `@hyderabad.bits-pilani.ac.in`)

## Environment notes
- `.env` currently points to Supabase project `mtqyrbyudtduyoqtumlt` (different from `.env.example` which references `zmjkkasiihycuutikims`)
- `SUPABASE_SERVICE_ROLE_KEY` is **missing** from `.env` — required for signup, cron jobs, migrations
- Mobile app is in `heartbits/` folder (README/docs call it `mobile/` — the folder was renamed)
- Web admin workflow: `bun run dev` on port 5000
- Mobile workflow: `cd heartbits && BROWSER=none bun run start -- --port 8080`

**Why:** User explicitly stated all of the above as the end-goal when importing this project.
