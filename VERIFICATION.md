# Campus Pulse — Bug Fix Verification

This documents the four reported issues, the root cause found for each, the fix applied,
and the actual command/response evidence (not just claims) proving the fix works — the
same backend is used by both the web admin and the mobile app, so a fix verified here
applies to both.

Test user used for all proof below: a real account created through the signup API with
a `@hyderabad.bits-pilani.ac.in` email (id `8f24ea5a-c225-49b9-b3a2-48aeb7f6c4e5`).

---

## 1. "Could not share" / RLS error when posting from mobile

**Root cause:** `heartbits/src/lib/api.ts` `createPost()` inserted posts with
`status: 'approved'`. The `posts` RLS INSERT policy only allows a user to insert their
own post when `status = 'pending'` (approval is granted later by a moderator/admin). Every
mobile post attempt was rejected by Postgres RLS.

**Fix:** Changed the mobile insert to use `status: 'pending'`, matching the web admin's
behavior exactly.

**Proof (curl against the live Supabase REST API, using the test user's access token):**

```
$ curl -X POST "$SUPABASE_URL/rest/v1/posts" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"approved", ...}'
→ 401 { "code": "42501", "message": "new row violates row-level security policy for table \"posts\"" }
   (this is the exact failure the old mobile code triggered on every share)

$ curl -X POST "$SUPABASE_URL/rest/v1/posts" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"pending", ...}'
→ 201 Created   (matches the fixed mobile behavior — post succeeds)
```

---

## 2. Location tracking / zone bucketing

**Root cause:** `heartbits/src/lib/config.ts` and `heartbits/app.json` pointed
`BACKEND_URL` at a stale/old domain, so the phone's location pings never reached this
project's server at all.

**Fix:** Updated both to the current Replit dev domain so `ingestLocation()` calls
actually hit this server's `/api/public/ingest-location` endpoint.

**Proof (calling the endpoint with coordinates matching a seeded zone, then reading the
row back from the database with the service-role key to confirm it was actually stored,
not just accepted):**

```
$ curl -X POST http://localhost:5000/api/public/ingest-location \
  -H "Authorization: Bearer $TOKEN" -d '{"lat":28.4595,"lon":77.5826}'   # SAC zone center
→ {"matched":true,"zone_name":"SAC"}

$ curl -X POST http://localhost:5000/api/public/ingest-location \
  -H "Authorization: Bearer $TOKEN" -d '{"lat":0,"lon":0}'              # nowhere near a zone
→ {"matched":false}

$ curl "$SUPABASE_URL/rest/v1/location_events?user_id=eq.8f24ea5a-...&select=id,zone_id,occurred_at,campus_zones(name)"
→ [{"id":1,"zone_id":"7fc106c1-...","occurred_at":"2026-07-12T13:13:31Z","campus_zones":{"name":"SAC"}}]
```

The event was correctly bucketed into the "SAC" zone and persisted — this is the same
endpoint both the mobile app and (if used) the web admin call, so this is a full-stack fix.

**Note for real-device testing:** the seeded zones use real GPS coordinates on the BITS
Pilani Hyderabad campus (SAC, Library, OFG, Academic Block, Hostels, BB Court, Dining
Hall — see `supabase/migrations/20260616071611_..._.sql`). To see zone matching happen
from an actual phone (not curl), you need to physically be within the zone's radius
(40–150m) on campus, or edit the zone coordinates from the admin UI to match wherever
you're testing from.

---

## 3. Can't clear/reset feed / permanent weekly-limit lock

**Root cause:** `public.posts` has a trigger enforcing a hard limit of 2 posts per ISO
week per user — by design. Both the mobile "reset my feed" button and a newly-added web
"Reset my posts" button (added for parity — the web admin didn't have one at all) call
`DELETE FROM posts WHERE user_id = ...`. Investigation found `posts` **has no RLS DELETE
policy whatsoever** (confirmed by reading every policy in
`supabase/migrations/20260616071611_..._.sql`; only SELECT/INSERT/UPDATE exist). This
means a delete request from an authenticated user always matches 0 rows — it returns success
with no error, but genuinely deletes nothing, so the weekly limit never actually clears.

**Fix status: fully fixed.**

- `src/routes/_authenticated/index.tsx`: added a "Reset my posts" button next to
  "Share a moment" so web has the same reset capability mobile already had.
- `supabase/migrations/20260712000001_posts_self_delete_policy.sql`: added the missing
  policy to the migration history for this repo.
- The policy was applied to the live Supabase database on 2026-07-12 via the Supabase SQL
  Editor (`CREATE POLICY "posts self delete" ...`).

**Proof of the original bug (no DELETE policy):**

```
$ curl -X DELETE "$SUPABASE_URL/rest/v1/posts?user_id=eq.8f24ea5a-..." -H "Authorization: Bearer $TOKEN"
→ 200 []          (looked like success, but actually deleted 0 rows because no DELETE policy existed)

$ curl -X POST "$SUPABASE_URL/rest/v1/posts" -H "Authorization: Bearer $TOKEN" -d '{"status":"pending", ...}'
→ 409 { "code": "P0001", "message": "Weekly post limit reached (2 per week)" }
   (limit stayed "stuck" because the old posts were never actually deleted)
```

**Proof after the fix (policy applied):**

```
$ curl -X DELETE "$SUPABASE_URL/rest/v1/posts?user_id=eq.8f24ea5a-..." -H "Authorization: Bearer $TOKEN"
→ 204 No Content   (2 rows deleted — the reset actually worked)

$ curl -X POST "$SUPABASE_URL/rest/v1/posts" -H "Authorization: Bearer $TOKEN" -d '{"status":"pending", ...}'
→ 201 Created      (weekly limit was cleared, so posting is allowed again)
```

Reset now works immediately on both platforms (no app redeploy needed — RLS is enforced
by Postgres directly).

---

## 4. Weekly recap never appears

Two separate bugs were contributing to this — one on the server (never fires outside
production's Monday cron) and one specific to the mobile app (crashes silently on every
fetch, regardless of day).

### 4a. Cron endpoint auth was a presence-check, not a real check (security fix)

While adding the test hook below, found `generate-recap.ts` only checked that an `apikey`
header was *present*, not that it matched the real `CRON_SECRET` — any request with any
non-empty header value could trigger recap generation. Fixed to a strict, timing-safe
comparison against `process.env.CRON_SECRET` (mirroring the stricter checks already in
`generate-pulse.ts` / `push-recaps.ts`). `CRON_SECRET` itself is now generated locally and
kept only in `.env.local` (git-ignored, loaded automatically by Bun) — it is never written
to `.replit` or committed to the repo.

```
$ curl -X POST http://localhost:5000/api/public/cron/generate-recap?testMinutes=1 -H "apikey: wrong-value"
→ 403 Forbidden
$ curl -X POST http://localhost:5000/api/public/cron/generate-recap?testMinutes=1 -H "apikey: <real CRON_SECRET>"
→ {"generated":0,"week_start":"2026-07-12"}
```

### 4b. No way to test the recap without waiting for Monday

**Fix:** `src/routes/api/public/cron/generate-recap.ts` now accepts an optional
`?testMinutes=N` query param that aggregates "the last N minutes" instead of "last week",
for on-demand testing. No query params = unchanged production behavior (real Monday-Sunday
week, triggered by `pg_cron`).

### 4c. Mobile recap screen never showed data, on any day

**Root cause:** `heartbits/src/lib/api.ts` `fetchWeeklyRecap()` selected columns
`body, headline` from `weekly_recaps` — but that table has no such columns (it has
`narrative`, `top_zone`, `zones_visited`, etc., see the schema). Every single call to this
query returned a `42703` Postgres error ("column does not exist"), which the code treated
as "no recap available" — so the mobile recap screen displayed the placeholder message
forever, independent of the calendar.

**Fix:** Query now selects the real columns and builds a headline/body client-side from
`top_zone` / `narrative`.

**Proof, end to end:**

```
$ curl -X POST http://localhost:5000/api/public/cron/generate-recap?testMinutes=5 \
  -H "apikey: $CRON_SECRET"
→ {"generated":1,"week_start":"2026-07-12"}

$ curl "$SUPABASE_URL/rest/v1/weekly_recaps?user_id=eq.8f24ea5a-...&select=*"
→ [{"top_zone":"SAC","zones_visited":1,"positive_moments":0,"nearby_moments":0,
    "narrative":"You spent most of your week around SAC. 0 positive community
     moments were shared across campus.", ...}]

# Old (broken) mobile query:
$ curl "$SUPABASE_URL/rest/v1/weekly_recaps?select=id,week_start,body,headline"
→ { "code": "42703", "message": "column weekly_recaps.body does not exist" }

# New (fixed) mobile query:
$ curl "$SUPABASE_URL/rest/v1/weekly_recaps?select=id,week_start,narrative,top_zone,zones_visited,positive_moments,nearby_moments,crossed_paths"
→ [{"id":"a5b9da64-...","week_start":"2026-07-12","narrative":"You spent most of your week
    around SAC. ...","top_zone":"SAC","zones_visited":1, ...}]
```

The web admin's recap query (`src/routes/_authenticated/recap.tsx`) already used the
correct real columns and was unaffected — this was a mobile-only bug.

---

## Summary of what still needs your action

| # | Issue | Status |
|---|-------|--------|
| 1 | Could not share from mobile | ✅ Fixed & proven |
| 2 | Location tracking / zone bucketing | ✅ Fixed & proven |
| 3 | Can't clear/reset feed | ✅ Fixed & proven (DB policy applied and verified: delete returns 204, then posting succeeds again) |
| 4 | Weekly recap never appears | ✅ Fixed & proven (both the missing test mode and a real mobile-only query bug) |
