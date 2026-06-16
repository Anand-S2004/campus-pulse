# Campus Pulse — Expo Integration Guide

This Lovable project owns the **backend + web admin** for Campus Pulse.
The student-facing app is a **separate React Native (Expo) project** that you build and ship.
This file is everything you need to wire the Expo app to this backend.

---

## 1. Backend you get for free

| What | Where |
|---|---|
| Postgres database | Lovable Cloud |
| Auth (email/password, college email gated) | Lovable Cloud |
| Public HTTP endpoints (this repo, under `src/routes/api/public/`) | `https://project--a47d5318-90cc-49fa-a067-99b4350c777a.lovable.app/api/public/*` |
| Cron jobs (every-5-min approvals push, daily pulse, weekly recap) | Already scheduled via `pg_cron` |

> Once you publish this Lovable project, the URL above goes live. Until then you can also hit the dev URL: `https://project--a47d5318-90cc-49fa-a067-99b4350c777a-dev.lovable.app`.

**Env vars to put in your Expo app (`app.config.ts` → `extra`):**

```
SUPABASE_URL=https://mtqyrbyudtduyoqtumlt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...   # the publishable key in .env at the repo root
BACKEND_URL=https://project--a47d5318-90cc-49fa-a067-99b4350c777a.lovable.app
```

---

## 2. Database tables (RLS-protected)

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

---

## 3. Auth flow (Expo side)

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage, // from @react-native-async-storage/async-storage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Sign up: hits OUR signup endpoint which enforces @ashoka.edu.in domain,
// creates profile row, and grants 'student' role. Then sign in normally.
async function signUp(email: string, password: string, displayName: string) {
  const res = await fetch(`${BACKEND_URL}/api/public/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  await supabase.auth.signInWithPassword({ email, password });
}
```

---

## 4. Reading the feed (chronological + pulse)

Use the supabase-js client directly — RLS only returns `status='approved'` to non-authors:

```ts
const { data: posts } = await supabase
  .from('posts')
  .select('id, category, location_label, description, created_at, profiles(display_name)')
  .eq('status', 'approved')
  .order('created_at', { ascending: false })
  .limit(50);

const { data: pulse } = await supabase
  .from('pulse_cards')
  .select('id, body, kind, generated_for')
  .order('generated_for', { ascending: false })
  .limit(3);
```

Interleave 1 pulse card at the top of the feed, then list posts chronologically.

---

## 5. Creating a post (2/week limit enforced server-side)

```ts
const { error } = await supabase.from('posts').insert({
  user_id: (await supabase.auth.getUser()).data.user!.id,
  category: 'sports',       // sports | kindness | academic | food | music | social | other
  location_label: 'BB Court',
  description: 'Pickup game 10:30 PM',
});
// error.message will say "Weekly post limit reached (2 per week)" if exceeded.
```

Status starts as `pending` automatically. Once a mod approves it on the web admin,
your user will receive a push notification within 5 minutes (see cron jobs below).

---

## 6. ❤️ Reaction

```ts
// add
await supabase.from('reactions').insert({ post_id, user_id });
// remove
await supabase.from('reactions').delete().eq('post_id', post_id).eq('user_id', user_id);
```

---

## 7. Background location (the privacy-first part)

Use `expo-location` with `startLocationUpdatesAsync` (TaskManager) every 5 min.
**Send raw coords to our endpoint — we resolve the nearest zone and discard the coords.**
Nothing about lat/lon ever touches storage.

```ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const TASK = 'CAMPUS_PULSE_LOCATION';

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const loc = locations[0];
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return;

  await fetch(`${BACKEND_URL}/api/public/ingest-location`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ lat: loc.coords.latitude, lon: loc.coords.longitude }),
  });
});

export async function startLocationCollection() {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (fg !== 'granted' || bg !== 'granted') return;

  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000,        // 5 minutes
    distanceInterval: 25,               // or every 25 m, whichever first
    foregroundService: {
      notificationTitle: 'Campus Pulse',
      notificationBody: 'Detecting your campus zone',
    },
    pausesUpdatesAutomatically: true,
  });
}
```

> **iOS limitation:** Apple kills 5-min background timers unless you ship a real
> "significant location change" use case. Falling back to foreground-only on iOS
> is fine for MVP.

---

## 8. Push notifications (Expo Push)

```ts
import * as Notifications from 'expo-notifications';

export async function registerPushToken() {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: 'YOUR_EAS_PROJECT_ID',
  });
  await fetch(`${BACKEND_URL}/api/public/register-push-token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
}
```

The backend stores tokens in `push_tokens` and the cron job at
`/api/public/cron/notify-approvals` pushes to them via Expo's REST API.

---

## 9. Weekly recap

Just read from `weekly_recaps` (RLS limits to current user):

```ts
const { data } = await supabase
  .from('weekly_recaps')
  .select('*')
  .order('week_start', { ascending: false })
  .limit(1)
  .single();
```

A push notification is also sent every Monday when the recap is generated.

---

## 10. Where things live in this repo

```
src/routes/api/public/
  ingest-location.ts          ← Expo posts raw coords here (discarded after zone match)
  register-push-token.ts      ← Expo registers Expo push tokens here
  auth/signup.ts              ← College-email-gated signup
  cron/generate-pulse.ts      ← Daily pulse cards (called by pg_cron)
  cron/generate-recap.ts      ← Weekly recap (Monday)
  cron/notify-approvals.ts    ← Every 5 min: push notify newly-approved authors
  cron/push-recaps.ts         ← Sub-route: pushes recap notifications

src/routes/_authenticated/    ← Web admin pages (moderators/admins use this)
  index.tsx     (feed)
  moderate.tsx  (approval queue)
  zones.tsx     (admin-only zone CRUD)
  recap.tsx     (your weekly recap)
```

---

## 11. Changing the college email domain

Edit two places:
1. `src/lib/college.ts` → `COLLEGE_EMAIL_DOMAIN`
2. Run a migration to update the `profiles.college_email_only` CHECK constraint regex.

---

## 12. Making someone a moderator

From the Cloud database UI (or via SQL):

```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'moderator' FROM auth.users WHERE email = 'name@ashoka.edu.in';
```

Same pattern with `'admin'` for full admin.
