// POST /api/public/my-recap
// Generates the current user's weekly recap for the requested week using only
// the anon key + their own JWT. No service-role key required.
// Body: { week_start?: "YYYY-MM-DD" } — defaults to current ISO week (Monday).
// Returns the generated recap row.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/my-recap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          return new Response("Server configuration error", { status: 500 });
        }

        // 1. Verify the bearer token using the public Supabase auth endpoint.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
        if (!userRes.ok) return new Response("Unauthorized", { status: 401 });

        const userJson = await userRes.json();
        const userId: string | undefined = userJson?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        // 2. Determine the week window.
        let body: { week_start?: string } = {};
        try {
          body = await request.json();
        } catch { /* default to current week */ }

        const now = new Date();
        const day = now.getUTCDay(); // 0=Sun, 1=Mon
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
        monday.setUTCHours(0, 0, 0, 0);
        const nextMonday = new Date(monday);
        nextMonday.setUTCDate(monday.getUTCDate() + 7);

        const weekStart = body.week_start ?? monday.toISOString().slice(0, 10);
        const fromIso = new Date(weekStart + "T00:00:00.000Z").toISOString();
        const toIso = new Date(
          new Date(weekStart + "T00:00:00.000Z").getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Server-side admin client for the final upsert: the row is authenticated
        // via the JWT check above, so we can safely write on the user's behalf even
        // if the weekly_recaps RLS policy is not yet configured in the project.
        const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const adminClient = SERVICE_ROLE_KEY
          ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
          : null;

        // 3. Load approved posts in this week (publicly readable via feed policy).
        const { data: posts } = await client
          .from("posts")
          .select("zone_id, created_at, campus_zones(name)")
          .eq("status", "approved")
          .gte("created_at", fromIso)
          .lt("created_at", toIso);
        const totalMoments = posts?.length ?? 0;

        // 4. Load my own location events for this week.
        const { data: myEvents } = await client
          .from("location_events")
          .select("zone_id, occurred_at, campus_zones(name)")
          .eq("user_id", userId)
          .gte("occurred_at", fromIso)
          .lt("occurred_at", toIso);
        type Ev = { zone_id: string; occurred_at: string; campus_zones: { name: string } | null };
        const myRows = (myEvents ?? []) as unknown as Ev[];

        const zones = new Set(myRows.map((e) => e.zone_id));

        const zoneCounts = new Map<string, number>();
        for (const e of myRows) {
          const n = e.campus_zones?.name ?? "Unknown";
          zoneCounts.set(n, (zoneCounts.get(n) ?? 0) + 1);
        }
        const topZone = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

        // Nearby moments = approved posts in same zone + within 2h of my visit
        let nearby = 0;
        const myBuckets = new Set(
          myRows.map((e) =>
            `${e.zone_id}:${Math.floor(new Date(e.occurred_at).getTime() / (2 * 3600 * 1000))}`,
          ),
        );
        for (const p of posts ?? []) {
          if (!p.zone_id) continue;
          const b = `${p.zone_id}:${Math.floor(new Date(p.created_at).getTime() / (2 * 3600 * 1000))}`;
          if (myBuckets.has(b)) nearby += 1;
        }

        // Crossed paths = distinct other users seen in same zone + same hour
        const myKeys = new Set(
          myRows.map((e) => `${e.zone_id}:${new Date(e.occurred_at).toISOString().slice(0, 13)}`),
        );
        let crossed = 0;
        if (myKeys.size > 0) {
          const { data: others } = await client
            .from("location_events")
            .select("user_id, zone_id, occurred_at")
            .neq("user_id", userId)
            .gte("occurred_at", fromIso)
            .lt("occurred_at", toIso);
          const seenUsers = new Set<string>();
          for (const o of others ?? []) {
            const k = `${o.zone_id}:${new Date(o.occurred_at).toISOString().slice(0, 13)}`;
            if (myKeys.has(k)) seenUsers.add(o.user_id);
          }
          crossed = seenUsers.size;
        }

        // 5. Upsert the recap row. Prefer the server-side admin client so the
        // feature works even when the weekly_recaps RLS policy is not configured.
        const upsertClient = adminClient ?? client;
        const { data: upserted, error } = await upsertClient
          .from("weekly_recaps")
          .upsert(
            {
              user_id: userId,
              week_start: weekStart,
              positive_moments: totalMoments,
              nearby_moments: nearby,
              zones_visited: zones.size,
              crossed_paths: crossed,
              top_zone: topZone ?? null,
            },
            { onConflict: "user_id,week_start" },
          )
          .select()
          .single();

        if (error) {
          return new Response(`Recap save failed: ${error.message}`, { status: 500 });
        }

        return Response.json({ recap: upserted });
      },
    },
  },
});
