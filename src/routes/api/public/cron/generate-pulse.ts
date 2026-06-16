// POST /api/public/cron/generate-pulse
// Triggered by pg_cron once a day.
// Reads anonymous zone events from the last 24h and writes 1–3 "Community Pulse" cards.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/generate-pulse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional: require the project's anon key in the apikey header (pg_cron sets it).
        const apikey = request.headers.get("apikey");
        if (!apikey) return new Response("Forbidden", { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Pull last-24h events with zone name.
        const { data: events } = await supabaseAdmin
          .from("location_events")
          .select("zone_id, occurred_at, campus_zones(name)")
          .gte("occurred_at", since);
        type Ev = { zone_id: string; occurred_at: string; campus_zones: { name: string } | null };
        const rows = (events ?? []) as unknown as Ev[];

        // Count by zone
        const byZone = new Map<string, { name: string; count: number }>();
        const byHour = new Map<number, number>();
        for (const e of rows) {
          const name = e.campus_zones?.name ?? "Unknown";
          const cur = byZone.get(name) ?? { name, count: 0 };
          cur.count += 1;
          byZone.set(name, cur);
          const h = new Date(e.occurred_at).getHours();
          byHour.set(h, (byHour.get(h) ?? 0) + 1);
        }

        const cards: { body: string; kind: string }[] = [];

        // 1. Most active zone today
        const top = [...byZone.values()].sort((a, b) => b.count - a.count)[0];
        if (top) cards.push({ kind: "daily_top_zone", body: `${top.name} was the most active area today.` });

        // 2. Total approved community moments this week
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const { count: postCount } = await supabaseAdmin
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved")
          .gte("created_at", weekStart.toISOString());
        if (postCount && postCount > 0) {
          cards.push({
            kind: "weekly_total",
            body: `${postCount} community moment${postCount === 1 ? "" : "s"} were shared this week.`,
          });
        }

        // 3. Peak hour
        const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
        if (peak) {
          const hour = peak[0];
          const display = `${((hour + 11) % 12) + 1} ${hour < 12 ? "AM" : "PM"}`;
          cards.push({ kind: "peak_hour", body: `Campus activity peaked around ${display}.` });
        }

        if (cards.length === 0) {
          return Response.json({ generated: 0 });
        }

        await supabaseAdmin
          .from("pulse_cards")
          .insert(cards.map((c) => ({ ...c, generated_for: new Date().toISOString().slice(0, 10) })));

        return Response.json({ generated: cards.length });
      },
    },
  },
});
