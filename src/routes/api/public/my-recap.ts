// POST /api/public/my-recap
// Generates (or refreshes) the weekly recap for the authenticated user.
// Body (optional): { testMinutes?: number }
//   testMinutes > 0  → analyse the last N minutes of data instead of the full
//                      Mon→Sun calendar week. Useful for testing without waiting
//                      a full week for data to accumulate.
//
// Header: Authorization: Bearer <user JWT>

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/my-recap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          return Response.json({ error: "Please sign in." }, { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return Response.json(
            { error: "Session expired. Please sign in again." },
            { status: 401 },
          );
        }

        const uid = userData.user.id;

        // Parse optional testMinutes.
        let body: { testMinutes?: unknown } = {};
        try {
          body = await request.json();
        } catch {
          /* empty body is fine */
        }
        const testMinutes = Number(body.testMinutes ?? 0);

        // Compute time window.
        const now = new Date();
        let fromDate: Date;
        let toDate: Date;
        let weekStart: string;

        if (Number.isFinite(testMinutes) && testMinutes > 0) {
          fromDate = new Date(now.getTime() - testMinutes * 60 * 1000);
          toDate = new Date(now.getTime() + 1000);
          weekStart = fromDate.toISOString().slice(0, 10);
        } else {
          const day = now.getUTCDay();
          fromDate = new Date(now);
          fromDate.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
          fromDate.setUTCHours(0, 0, 0, 0);
          toDate = new Date(fromDate);
          toDate.setUTCDate(fromDate.getUTCDate() + 7);
          weekStart = fromDate.toISOString().slice(0, 10);
        }

        const fromIso = fromDate.toISOString();
        const toIso = toDate.toISOString();

        // Load approved posts in the window (global, not per-user).
        const { data: posts } = await supabaseAdmin
          .from("posts")
          .select("zone_id, created_at")
          .eq("status", "approved")
          .gte("created_at", fromIso)
          .lt("created_at", toIso);
        const totalMoments = posts?.length ?? 0;

        // Load this user's location events.
        const { data: myEvents } = await supabaseAdmin
          .from("location_events")
          .select("zone_id, occurred_at, campus_zones(name)")
          .eq("user_id", uid)
          .gte("occurred_at", fromIso)
          .lt("occurred_at", toIso);

        type Ev = {
          zone_id: string;
          occurred_at: string;
          campus_zones: { name: string } | null;
        };
        const myRows = (myEvents ?? []) as unknown as Ev[];

        // Unique zones visited.
        const zones = new Set(myRows.map((e) => e.zone_id));

        // Top zone by visit count.
        const zoneCounts = new Map<string, number>();
        for (const e of myRows) {
          const n = e.campus_zones?.name ?? "Unknown";
          zoneCounts.set(n, (zoneCounts.get(n) ?? 0) + 1);
        }
        const topZone =
          [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
          null;

        // Nearby moments: approved posts in same zone within 2 h of my visit.
        const myBuckets = new Set(
          myRows.map(
            (e) =>
              `${e.zone_id}:${Math.floor(new Date(e.occurred_at).getTime() / (2 * 3600 * 1000))}`,
          ),
        );
        let nearby = 0;
        for (const p of posts ?? []) {
          if (!p.zone_id) continue;
          const b = `${p.zone_id}:${Math.floor(new Date(p.created_at).getTime() / (2 * 3600 * 1000))}`;
          if (myBuckets.has(b)) nearby += 1;
        }

        // Crossed paths: distinct other users in same zone + same hour.
        const myKeys = new Set(
          myRows.map(
            (e) =>
              `${e.zone_id}:${new Date(e.occurred_at).toISOString().slice(0, 13)}`,
          ),
        );
        let crossed = 0;
        if (myKeys.size > 0) {
          const { data: others } = await supabaseAdmin
            .from("location_events")
            .select("user_id, zone_id, occurred_at")
            .neq("user_id", uid)
            .gte("occurred_at", fromIso)
            .lt("occurred_at", toIso);
          const seen = new Set<string>();
          for (const o of others ?? []) {
            const k = `${o.zone_id}:${new Date(o.occurred_at).toISOString().slice(0, 13)}`;
            if (myKeys.has(k)) seen.add(o.user_id);
          }
          crossed = seen.size;
        }

        // Shared routine score.
        const myZoneIds = new Set(myRows.map((e) => e.zone_id));
        let sharedSpaceCount = 0;
        if (myZoneIds.size > 0) {
          const { data: allWeek } = await supabaseAdmin
            .from("location_events")
            .select("user_id, zone_id")
            .neq("user_id", uid)
            .gte("occurred_at", fromIso)
            .lt("occurred_at", toIso);
          const sharedUsers = new Set<string>();
          for (const ev of allWeek ?? []) {
            if (myZoneIds.has(ev.zone_id)) sharedUsers.add(ev.user_id);
          }
          sharedSpaceCount = sharedUsers.size;
        }

        const sharedRoutineScore = Math.min(
          100,
          Math.round(sharedSpaceCount * 0.3 + crossed * 0.25),
        );

        // Narrative.
        const parts: string[] = [];
        if (topZone) parts.push(`You spent most of your time around ${topZone}.`);
        parts.push(`${totalMoments} positive community moments were shared on campus.`);
        if (nearby > 0) parts.push(`You were near ${nearby} of those moments.`);
        if (crossed > 0) parts.push(`Your path crossed with ${crossed} other students.`);
        if (sharedSpaceCount > 0)
          parts.push(`${sharedSpaceCount} people shared at least one campus space with you.`);
        const narrative = parts.join(" ");

        // Upsert.
        const { error: upsertErr } = await supabaseAdmin
          .from("weekly_recaps")
          .upsert(
            {
              user_id: uid,
              week_start: weekStart,
              positive_moments: totalMoments,
              nearby_moments: nearby,
              zones_visited: zones.size,
              crossed_paths: crossed,
              top_zone: topZone,
              shared_routine_score: sharedRoutineScore,
              shared_space_count: sharedSpaceCount,
              common_path_count: 0,
              repeat_community_count: 0,
              narrative,
            } as never,
            { onConflict: "user_id,week_start" },
          );

        if (upsertErr) {
          console.error("my-recap upsert error:", upsertErr);
          return Response.json(
            { error: "Could not save recap." },
            { status: 500 },
          );
        }

        return Response.json({
          ok: true,
          week_start: weekStart,
          positive_moments: totalMoments,
          nearby_moments: nearby,
          zones_visited: zones.size,
          crossed_paths: crossed,
          top_zone: topZone,
          narrative,
        });
      },
    },
  },
});
