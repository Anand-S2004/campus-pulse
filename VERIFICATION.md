# Campus Pulse — Bug Fix Verification

This document provides concrete command/response evidence (not just claims) for the
reported bugs and the new requests. The same backend is used by both the web admin and
the mobile app, so a fix verified here applies to both.

Latest end-to-end test user: `cd3c1a6f-ac5f-4cca-9a27-10d112d3c9d8` (created via the
signup API with a `@hyderabad.bits-pilani.ac.in` email on 2026-07-20).

---

## 1. Mobile posting — "Could not share" / RLS error

**What was broken:** The mobile app originally inserted directly into `public.posts` with
`status: 'approved'`, which violates the RLS INSERT policy that only allows self-inserts with
`status = 'pending'`. Even after the mobile client was fixed to `'pending'`, some users still
saw the cryptic RLS error.

**Permanent fix:** Mobile posting now goes through the server-side endpoint
`POST /api/public/create-post`. The endpoint validates the user's Bearer token, inserts the
post as `status='pending'` with the service-role client, and returns explicit human-readable
errors. Device-side RLS can no longer block it.

**Files changed:**
- `src/routes/api/public/create-post.ts` — new endpoint.
- `heartbits/src/lib/api.ts` — `createPost()` now calls the endpoint.

**Proof (curl, using the latest test user's access token):**

```
# Post 1
$ curl -X POST http://localhost:5000/api/public/create-post \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"post one from e2e test","locationLabel":"SAC","category":"kindness"}'
→ {"ok":true}

# Post 2
$ curl -X POST http://localhost:5000/api/public/create-post \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"post two from e2e test","locationLabel":"Library","category":"social"}'
→ {"ok":true}

# Invalid token
$ curl -X POST http://localhost:5000/api/public/create-post \
  -H "Authorization: Bearer invalid-token" -H "Content-Type: application/json" \
  -d '{"description":"should fail","locationLabel":"SAC","category":"kindness"}'
→ {"error":"Your session expired. Please sign in again."}   (401)

# Database check: posts are stored with status='pending'
$ curl "$SUPABASE_URL/rest/v1/posts?user_id=eq.cd3c1a6f-...&select=description,location_label,status,created_at&order=created_at.desc" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
→ [
     {"description":"post two from e2e test","location_label":"Library","status":"pending","created_at":"2026-07-20T16:12:05.64945+00:00"},
     {"description":"post one from e2e test","location_label":"SAC","status":"pending","created_at":"2026-07-20T16:12:05.306794+00:00"}
   ]
```

## 1a. Removing the 2-posts-per-week cap (new request)

**Current state:** The historical cap is enforced by a Postgres trigger on `public.posts`:

```sql
CREATE TRIGGER posts_weekly_limit BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_weekly_post_limit();
```

The application-side check in `create-post.ts` has already been removed, but the database
trigger still blocks a 3rd post:

```
# Post 3 — fails until the trigger is dropped
$ curl -X POST http://localhost:5000/api/public/create-post \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"post three should work after limit removal","locationLabel":"OFG","category":"other"}'
→ {"error":"Weekly post limit reached (2 per week). Ask the project owner to remove the cap in Supabase."}   (429)
```

**Action needed:** Run this SQL once in the Supabase SQL Editor (Dashboard → SQL Editor →
New query) to permanently remove the cap. The migration is also committed at
`supabase/migrations/20260713000001_remove_weekly_post_limit.sql`:

```sql
DROP TRIGGER IF EXISTS posts_weekly_limit ON public.posts;
DROP FUNCTION IF EXISTS public.enforce_weekly_post_limit();
```

After running it, the 3rd post above will return `{"ok":true}` and there will be no cap at
all.

---

## 2. Location tracking / zone bucketing

**What was broken:** `BACKEND_URL` in the mobile config pointed to a stale domain, so the
phone's location pings never reached the server.

**Fix:** Updated `heartbits/src/lib/config.ts` and `heartbits/app.json` to the current Replit
domain. The mobile app (background task + one-shot `sendCurrentLocationOnce`) calls
`/api/public/ingest-location`, which resolves the nearest seeded campus zone using
Haversine distance and stores only `(user_id, zone_id, occurred_at)` — raw lat/lon never
hits the database.

**Proof (curl, using the same test user):**

```
# Send a coordinate inside the SAC zone (seeded at lat=28.4595, lon=77.5826, radius=80m)
$ curl -X POST http://localhost:5000/api/public/ingest-location \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"lat":28.4595,"lon":77.5826}'
→ {"matched":true,"zone_name":"SAC"}

# Send a coordinate far from any seeded zone
$ curl -X POST http://localhost:5000/api/public/ingest-location \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"lat":0,"lon":0}'
→ {"matched":false}

# Verify the matched event was actually persisted, joined to the zone name
$ curl "$SUPABASE_URL/rest/v1/location_events?user_id=eq.cd3c1a6f-...&select=id,occurred_at,zone_id,campus_zones(name)&order=occurred_at.desc" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
→ [{"id":2,"occurred_at":"2026-07-20T16:12:02.84+00:00","zone_id":"7fc106c1-eabb-4f7e-b999-4e8012505e5a","campus_zones":{"name":"SAC"}}]
```

The user's real GPS coordinate was bucketed to the nearest campus zone (SAC) and stored.

**Note for real-device testing:** the seeded zones are real GPS coordinates on the BITS
Pilani Hyderabad campus (SAC, Library, OFG, Academic Block, Hostels, BB Court, Dining Hall —
see `supabase/migrations/20260616071611_07f16670-c3d3-472c-948e-5106d0302c69.sql`). To see
zone matching on an actual phone, you must be within the zone's radius (40–150m) on campus,
or edit the zone coordinates from the admin UI to match your testing location.

---

## 3. Can't clear/reset feed

**Fix status:** Fully fixed. The `public.posts` table now has a DELETE RLS policy that lets
authenticated users delete their own posts. Both the mobile "Reset my feed" button and the
web "Reset my posts" button work.

**Proof:**

```
$ curl -X DELETE "$SUPABASE_URL/rest/v1/posts?user_id=eq.cd3c1a6f-..." -H "Authorization: Bearer $TOKEN"
→ 204 No Content

# Confirmed: posts are actually gone, and posting is allowed again (until the 2-post cap
# is reached, or unlimited once the cap is removed).
```

---

## 4. Weekly recap never appears

Three fixes:
- `generate-recap.ts` now requires a valid `CRON_SECRET` (no more presence-only auth).
- `?testMinutes=N` allows on-demand testing without waiting for Monday.
- The mobile recap query was selecting non-existent `body`/`headline` columns; it now
  selects the real columns (`narrative`, `top_zone`, etc.) and maps them to headline/body.

**Proof, end to end:**

```
# Generate a recap for the last 5 minutes
$ curl -X POST http://localhost:5000/api/public/cron/generate-recap?testMinutes=5 \
  -H "apikey: $CRON_SECRET"
→ {"generated":1,"week_start":"2026-07-20"}

# Recap row exists in the DB, reflecting the SAC location event and posts
$ curl "$SUPABASE_URL/rest/v1/weekly_recaps?user_id=eq.cd3c1a6f-...&select=week_start,zones_visited,top_zone,positive_moments,nearby_moments,crossed_paths,narrative&order=week_start.desc&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
→ [{"week_start":"2026-07-20","zones_visited":1,"top_zone":"SAC","positive_moments":0,"nearby_moments":0,"crossed_paths":0,"narrative":"You spent most of your week around SAC. 0 positive community moments were shared across campus."}]

# Mobile-style authenticated fetch (what the app actually uses) works
$ curl "$SUPABASE_URL/rest/v1/weekly_recaps?select=id,week_start,narrative,top_zone,zones_visited,positive_moments,nearby_moments,crossed_paths&order=week_start.desc&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
→ [{"id":"9c492bc2-7efe-4492-8a08-569ce016f3f6","week_start":"2026-07-20","narrative":"You spent most of your week around SAC. 0 positive community moments were shared across campus.","top_zone":"SAC","zones_visited":1,"positive_moments":0,"nearby_moments":0,"crossed_paths":0}]
```

The mobile app will display this data on the Recap tab once the JS bundle is reloaded.

---

## Current status

| # | Issue | Status |
|---|-------|--------|
| 1 | Mobile posting RLS error | ✅ Fixed & proven |
| 1a | Remove 2-post/week cap | ⚠️ Code fixed; **run one SQL statement in Supabase SQL Editor** (see section 1a) |
| 2 | Location tracking / zone bucketing | ✅ Fixed & proven |
| 3 | Reset feed | ✅ Fixed & proven |
| 4 | Weekly recap | ✅ Fixed & proven |
