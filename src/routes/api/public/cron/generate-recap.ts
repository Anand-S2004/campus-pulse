// POST /api/public/cron/generate-recap
// Triggered by pg_cron every Monday — generates personalised weekly recaps for every user.
// "Your Week: 42 positive moments happened, you spent time near 7 of them..."
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/generate-recap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { timingSafeEqual } = await import("node:crypto");

        const apikey = request.headers.get("apikey");
        const expected = process.env.CRON_SECRET;
        const isAuthorized =
          !!apikey &&
          !!expected &&
          apikey.length === expected.length &&
          timingSafeEqual(Buffer.from(apikey), Buffer.from(expected));
        if (!isAuthorized) return new Response("Forbidden", { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Testing hook: ?testMinutes=5 generates a recap over the last N minutes
        // instead of the real Monday→Sunday week, so the feature can be verified
        // without waiting for an actual week to pass. Never used by the real
        // pg_cron schedule (it calls this route with no query params).
        const testMinutes = Number(new URL(request.url).searchParams.get("testMinutes") ?? "");
        const now = new Date();

        let lastMonday: Date;
        let thisMonday: Date;
        if (Number.isFinite(testMinutes) && testMinutes > 0) {
          lastMonday = new Date(now.getTime() - testMinutes * 60 * 1000);
          thisMonday = new Date(now.getTime() + 1000); // include events up to "now"
        } else {
          // Compute last week's Monday → Sunday window.
          const day = now.getUTCDay(); // 0=Sun, 1=Mon
          lastMonday = new Date(now);
          lastMonday.setUTCDate(now.getUTCDate() - ((day + 6) % 7) - 7);
          lastMonday.setUTCHours(0, 0, 0, 0);
          thisMonday = new Date(lastMonday);
          thisMonday.setUTCDate(lastMonday.getUTCDate() + 7);
        }

        const fromIso = lastMonday.toISOString();
        const toIso = thisMonday.toISOString();

        // Approved posts last week (with zone info)
        const { data: posts } = await supabaseAdmin
          .from("posts")
          .select("zone_id, created_at, campus_zones(name)")
          .eq("status", "approved")
          .gte("created_at", fromIso)
          .lt("created_at", toIso);
        const totalMoments = posts?.length ?? 0;

        // Iterate users who had any location event last week.
        const { data: activeUsers } = await supabaseAdmin
          .from("location_events")
          .select("user_id")
          .gte("occurred_at", fromIso)
          .lt("occurred_at", toIso);
        const userIds = Array.from(new Set((activeUsers ?? []).map((u) => u.user_id)));

        const weekStartDate = lastMonday.toISOString().slice(0, 10);
        let generated = 0;

        for (const uid of userIds) {
          const { data: myEvents } = await supabaseAdmin
            .from("location_events")
            .select("zone_id, occurred_at, campus_zones(name)")
            .eq("user_id", uid)
            .gte("occurred_at", fromIso)
            .lt("occurred_at", toIso);
          type Ev = { zone_id: string; occurred_at: string; campus_zones: { name: string } | null };
          const myRows = (myEvents ?? []) as unknown as Ev[];

          // Unique zones visited
          const zones = new Set(myRows.map((e) => e.zone_id));

          // Top zone by count
          const zoneCounts = new Map<string, number>();
          for (const e of myRows) {
            const n = e.campus_zones?.name ?? "Unknown";
            zoneCounts.set(n, (zoneCounts.get(n) ?? 0) + 1);
          }
          const topZone = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

          // "Nearby moments" = approved posts in same zone + within 2h of my visit
          let nearby = 0;
          const myBuckets = new Set(
            myRows.map((e) => `${e.zone_id}:${Math.floor(new Date(e.occurred_at).getTime() / (2 * 3600 * 1000))}`),
          );
          for (const p of posts ?? []) {
            if (!p.zone_id) continue;
            const b = `${p.zone_id}:${Math.floor(new Date(p.created_at).getTime() / (2 * 3600 * 1000))}`;
            if (myBuckets.has(b)) nearby += 1;
          }

          // "Crossed paths" = distinct other users seen in same zone + same hour
          const myKeys = new Set(
            myRows.map((e) => `${e.zone_id}:${new Date(e.occurred_at).toISOString().slice(0, 13)}`),
          );
          let crossed = 0;
          if (myKeys.size > 0) {
            const { data: others } = await supabaseAdmin
              .from("location_events")
              .select("user_id, zone_id, occurred_at")
              .neq("user_id", uid)
              .gte("occurred_at", fromIso)
              .lt("occurred_at", toIso);
            const seenUsers = new Set<string>();
            for (const o of others ?? []) {
              const k = `${o.zone_id}:${new Date(o.occurred_at).toISOString().slice(0, 13)}`;
              if (myKeys.has(k)) seenUsers.add(o.user_id);
            }
            crossed = seenUsers.size;
          }
          // Shared spaces = users who visited at least one zone I visited
          const myZoneIds = new Set(myRows.map((e) => e.zone_id));

          const { data: allWeekEvents } = await supabaseAdmin
            .from("location_events")
            .select("user_id, zone_id, occurred_at")
            .neq("user_id", uid)
            .gte("occurred_at", fromIso)
            .lt("occurred_at", toIso);

          const sharedUsers = new Set<string>();
          const repeatedUsers = new Map<string, number>();
          const commonPathUsers = new Map<string, number>();

          for (const ev of allWeekEvents ?? []) {
            if (myZoneIds.has(ev.zone_id)) {
              sharedUsers.add(ev.user_id);
            }

            const hourKey =
              `${ev.zone_id}:${new Date(ev.occurred_at).toISOString().slice(0, 13)}`;

            if (myKeys.has(hourKey)) {
              repeatedUsers.set(
                ev.user_id,
                (repeatedUsers.get(ev.user_id) ?? 0) + 1,
              );
            }
          }

          // Common paths = people who matched me at least 3 separate times
          for (const [otherUser, count] of repeatedUsers.entries()) {
            if (count >= 3) {
              commonPathUsers.set(otherUser, count);
            }
          }

          const sharedSpaceCount = sharedUsers.size;
          const commonPathCount = commonPathUsers.size;

          const repeatCommunityCount =
            [...commonPathUsers.values()].filter((v) => v >= 5).length;

          // Better score
          const sharedRoutineScore = Math.min(
            100,
            Math.round(
              sharedSpaceCount * 0.3 +
              commonPathCount * 6 +
              repeatCommunityCount * 10 +
              crossed * 0.25,
            ),
          );
          // narrative
          const narrativeParts: string[] = [];
          if (topZone) {
            narrativeParts.push(
              `You spent most of your week around ${topZone}.`
            );
          }

          narrativeParts.push(
            `${totalMoments} positive community moments were shared across campus.`
          );

          if (nearby > 0) {
            narrativeParts.push(
              `You were near ${nearby} of those moments.`
            );
          }

          if (crossed > 0) {
            narrativeParts.push(
              `Your path intersected with ${crossed} other students.`
            );
          }

          if (sharedSpaceCount > 0) {
            narrativeParts.push(
              `${sharedSpaceCount} people shared at least one campus space with you this week.`
            );
          }

          if (commonPathCount > 0) {
            narrativeParts.push(
              `${commonPathCount} students followed a similar weekly path through campus.`
            );
          }

          if (repeatCommunityCount > 0) {
            narrativeParts.push(
              `You repeatedly encountered familiar faces throughout the week.`
            );
          }

          if (sharedRoutineScore >= 50) {
            narrativeParts.push(
              `Your routine was strongly connected to the broader campus community.`
            );
          } else if (sharedRoutineScore >= 25) {
            narrativeParts.push(
              `Your routine overlapped with several shared campus patterns.`
            );
          }

          const narrative = narrativeParts.join(" ");
          await supabaseAdmin.from("weekly_recaps").upsert<any>(
            {
              user_id: uid,
              week_start: weekStartDate,

              positive_moments: totalMoments,
              nearby_moments: nearby,
              zones_visited: zones.size,
              crossed_paths: crossed,
              top_zone: topZone ?? null,

              shared_routine_score: sharedRoutineScore,
              shared_space_count: sharedSpaceCount,
              common_path_count: commonPathCount,
              repeat_community_count: repeatCommunityCount,
              narrative,
            },
            {
              onConflict: "user_id,week_start",
            },
          );
          generated += 1;
        }

        // Fire-and-forget push to recap recipients
        await fetch(new URL(request.url).origin + "/api/public/cron/push-recaps", {
          method: "POST",
          headers: { "content-type": "application/json", apikey },
          body: JSON.stringify({ week_start: weekStartDate }),
        }).catch(() => null);

        return Response.json({ generated, week_start: weekStartDate });
      },
    },
  },
});
